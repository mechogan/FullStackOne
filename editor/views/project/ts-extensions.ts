import { EditorView } from "@codemirror/view";
import { WorkerTS } from "../../typescript";
import { CompletionContext } from "@codemirror/autocomplete";
import { Store } from "../../store";
import packages from "../../lib/packages";

let ignoredPackages = new Set<string>();
export function Packages() {
    Store.packages.ignored.subscribe((ignored) => (ignoredPackages = ignored));
}

export const tsErrorLinter = (filePath: string) => async (view: EditorView) => {
    await WorkerTS.call().updateFile(filePath, view.state.doc.toString());

    const getAllTsError = async () => {
        const tsErrors = await Promise.all([
            WorkerTS.call().getSemanticDiagnostics(filePath),
            WorkerTS.call().getSyntacticDiagnostics(filePath),
            WorkerTS.call().getSuggestionDiagnostics(filePath)
        ]);

        return tsErrors.flat();
    };

    let tsErrors = await getAllTsError();

    const needsTypes = tsErrors.filter((e) => {
        if (e.code !== 7016 && e.code !== 2307) return false;

        const text = e.file?.text || view.state.doc.toString();

        const moduleName = text
            .toString()
            .slice(e.start, e.start + e.length)
            .slice(1, -1);

        return (
            !moduleName.startsWith(".") &&
            !ignoredPackages.has(`@types/${moduleName}`)
        );
    });

    if (needsTypes.length) {
        needsTypes.forEach((e) => {
            const text = e.file?.text || view.state.doc.toString();
            const moduleName = text
                .toString()
                .slice(e.start, e.start + e.length)
                .slice(1, -1);
            packages.install(`@types/${moduleName}`);
        });
        await WorkerTS.restart();
        tsErrors = await getAllTsError();
    }

    return tsErrors
        .filter((tsError) => !!tsError)
        .map((tsError) => {
            return {
                from: tsError.start,
                to: tsError.start + tsError.length,
                severity: tsError.code === 7016 ? "warning" : "error",
                message:
                    typeof tsError.messageText === "string"
                        ? tsError.messageText
                        : (tsError?.messageText?.messageText ?? "")
            };
        });
};

export const tsAutocomplete =
    (filePath: string) => async (ctx: CompletionContext) => {
        const text = ctx.state.doc.toString();
        await WorkerTS.call().updateFile(filePath, text);

        let tsCompletions = await WorkerTS.call().getCompletionsAtPosition(
            filePath,
            ctx.pos,
            {
                allowIncompleteCompletions: true,
                allowRenameOfImportPath: true,
                includeCompletionsForImportStatements: true,
                includeCompletionsForModuleExports: true
            }
        );

        if (!tsCompletions) return { from: ctx.pos, options: [] };

        let lastWord, from;
        for (let i = ctx.pos - 1; i >= 0; i--) {
            if (
                [
                    " ",
                    ".",
                    "\n",
                    ":",
                    "{",
                    "<",
                    '"',
                    "'",
                    "(",
                    "[",
                    "!"
                ].includes(text[i]) ||
                i === 0
            ) {
                from = i === 0 ? i : i + 1;
                lastWord = text.slice(from, ctx.pos).trim();
                break;
            }
        }

        if (lastWord) {
            tsCompletions.entries = tsCompletions.entries.filter((completion) =>
                completion.name.startsWith(lastWord)
            );
        }

        return {
            from: ctx.pos,
            options: tsCompletions.entries.map((completion) => ({
                label: completion.name,
                apply: (view: EditorView) => {
                    WorkerTS.call()
                        .getCompletionEntryDetails(
                            filePath,
                            ctx.pos,
                            completion.name,
                            {},
                            completion.source,
                            {
                                allowIncompleteCompletions: true,
                                allowRenameOfImportPath: true,
                                includeCompletionsForImportStatements: true,
                                includeCompletionsForModuleExports: true
                            },
                            completion.data
                        )
                        .then((details) => {
                            if (!details?.codeActions?.length) return;

                            view.dispatch({
                                changes: details.codeActions
                                    .at(0)
                                    .changes.map(({ textChanges }) =>
                                        textChanges.map((change) => ({
                                            from: change.span.start,
                                            to:
                                                change.span.start +
                                                change.span.length,
                                            insert: change.newText
                                        }))
                                    )
                                    .flat()
                            });
                        });

                    view.dispatch({
                        changes: {
                            from,
                            to: ctx.pos,
                            insert: completion.name
                        }
                    });
                    if (from === ctx.pos) {
                        view.dispatch({
                            selection: {
                                anchor: from + completion.name.length,
                                head: from + completion.name.length
                            }
                        });
                    }
                }
            }))
        };
    };

export const tsTypeDefinition =
    (filePath: string) => async (view: EditorView, pos: number, side) => {
        const info = await WorkerTS.call().getQuickInfoAtPosition(
            filePath,
            pos
        );
        const text = info?.displayParts?.map(({ text }) => text).join("");

        if (!text) return null;

        return {
            pos: info.textSpan.start,
            end: info.textSpan.start + info.textSpan.length,
            above: true,
            create(view) {
                let dom = document.createElement("div");
                const pre = document.createElement("pre");
                pre.innerText = text;
                dom.append(pre);
                return { dom };
            }
        };
    };

export const navigateToDefinition =
    (filePath: string) => (e: MouseEvent, view: EditorView) => {
        if (!e.metaKey && !e.ctrlKey) return null;

        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });

        if (!pos) return;

        WorkerTS.call()
            .getDefinitionAtPosition(filePath, pos)
            .then((defs) => {
                if (!defs?.length) return;

                Store.editor.codeEditor.openFile(defs.at(0).fileName);
                Store.editor.codeEditor.focusFile(defs.at(0).fileName);
            });
    };
