import { Project } from "../../../editor/api/projects/types";
import { InstanceEditor } from "../../node/interfaces/instanceEditor";

export class InstanceEditorDocker implements InstanceEditor {
    rootDirectory: string;
    baseJS: string;
    configDirectory: string;
    nodeModulesDirectory: string;
    cacheDirectory: string;
    
    createNewInstance(project: Project): void {
        throw new Error("Method not implemented.");
    }
    
}