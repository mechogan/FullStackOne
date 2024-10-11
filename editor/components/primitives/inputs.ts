import { Button } from "./button";

type InputOpts = {
    label: string
}

export function InputText(opts?: Partial<InputOpts>) {
    const container = document.createElement("div");
    container.classList.add("input-text");

    if (opts?.label) {
        container.innerHTML = `<label>${opts.label}</label>`;
    }

    const input = document.createElement("input");

    container.append(input);

    return {
        container,
        input
    }
}

export function InputFile(opts?: Partial<InputOpts>) {
    const container = document.createElement("div");
    container.classList.add("input-file");

    if (opts?.label) {
        container.innerHTML = `<label>${opts.label}</label>`;
    }

    const input = document.createElement("input");
    input.type = "file";

    container.append(input);

    const overrideUI = document.createElement("div");

    const fileName = document.createElement("span");
    fileName.innerText = "No file chosen";

    input.addEventListener("change", () => {
        const file = input.files[0];
        fileName.innerText = file?.name || "No file chosen";
    })

    const button = Button({
        iconRight: "File",
        text: "Select"
    });

    button.onclick = (e) => {
        e.preventDefault();
        input.click();
    };

    overrideUI.append(
        fileName,
        button
    );

    container.append(overrideUI);

    return {
        container,
        input
    }
}

export function InputSwitch(opts?: Partial<InputOpts>) {
    const container = document.createElement("div");
    container.classList.add("input-switch");

    if (opts?.label) {
        container.innerHTML = `<label>${opts.label}</label>`;
    }

    const input = document.createElement("input");
    input.type = "checkbox";

    input.addEventListener("change", () => {
        if (input.checked)
            container.classList.add("checked")
        else
            container.classList.remove("checked")
    });

    container.append(input);

    const overrideUI = document.createElement("div");

    const switchEl = document.createElement("div");
    switchEl.onclick = () => input.click();

    switchEl.innerHTML = `<div></div>`;
    overrideUI.append(switchEl);
    container.append(overrideUI);

    return {
        input,
        container
    }
}

export function InputRadio() {
    const container = document.createElement("div");
    container.classList.add("input-radio");

    const input = document.createElement("input");
    input.type = "radio";

    input.addEventListener("change", () => {
        if (input.checked)
            container.classList.add("checked")
        else
            container.classList.remove("checked")
    })

    const overrideUI = document.createElement("div");
    overrideUI.onclick = () => input.click();

    overrideUI.innerHTML = "<div></div>";

    container.append(input, overrideUI);

    return {
        container,
        input
    }
}

export function InputCheckbox() {
    const container = document.createElement("div");
    container.classList.add("input-checkbox");

    const input = document.createElement("input");
    input.type = "checkbox";

    input.addEventListener("change", () => {
        if (input.checked)
            container.classList.add("checked")
        else
            container.classList.remove("checked")
    })

    const overrideUI = document.createElement("div");
    overrideUI.onclick = () => input.click();

    overrideUI.innerHTML = "<div></div>";

    container.append(input, overrideUI);

    return {
        container,
        input
    }
}


// input observer
const updateOverriddenInputs = () => {
    const inputsChecked = document.querySelectorAll<HTMLInputElement>("input[type=checkbox], input[type=radio]");
    inputsChecked.forEach(input => {
        const parent = input.parentElement;
        if (input.checked)
            parent.classList.add("checked")
        else
            parent.classList.remove("checked")
    });

    const inputsFile = document.querySelectorAll<HTMLInputElement>("input[type=file]");
    inputsFile.forEach(inputFile => {
        const file = inputFile.files[0];
        const fileName = inputFile.nextElementSibling.children[0] as HTMLSpanElement;
        fileName.innerText = file?.name || "No file chosen";
    })
}
setInterval(updateOverriddenInputs, 100);