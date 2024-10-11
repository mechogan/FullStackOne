import { Badge } from "./components/primitives/badge";
import { Button, ButtonGroup } from "./components/primitives/button";
import { InputCheckbox, InputFile, InputRadio, InputSwitch, InputText } from "./components/primitives/inputs";

// Typography
const heading1 = document.createElement("h1");
heading1.innerText = "Heading 1";

const heading2 = document.createElement("h2");
heading2.innerText = "Heading 2";

const heading3 = document.createElement("h3");
heading3.innerText = "Heading 3";

const mediumBold = document.createElement("div");
mediumBold.innerHTML = "<b>Medium Bold</b>";

const medium = document.createElement("div");
medium.innerText = "Medium";

const label = document.createElement("label");
label.innerText = "Label";

const small = document.createElement("div");
small.innerHTML = "<small>Small</small>";

const xsmall = document.createElement("div");
xsmall.classList.add("font-x-small");
xsmall.innerText = "X Small";

const externalLink = document.createElement("a");
externalLink.innerText = "External Link";

document.body.append(
    heading1,
    heading2,
    heading3,
    mediumBold,
    medium,
    label,
    small,
    xsmall,
    externalLink
);

// Badge
const text = "Badge";
document.body.append(Badge({
    text,
}),
    Badge({
        text,
        type: "success"
    }),
    Badge({
        text,
        type: "error"
    }),
    Badge({
        text,
        type: "warning"
    }),
    Badge({
        text,
        type: "info"
    }),
    Badge({
        text,
        type: "info-2"
    })
)


// Button
const buttonDefault = Button({
    iconLeft: "Git",
    iconRight: "Git",
    text: "Button"
})

const buttonDanger = Button({
    iconLeft: "Git",
    iconRight: "Git",
    text: "Button",
    color: "red"
})

const buttonDisabled = Button({
    iconLeft: "Git",
    iconRight: "Git",
    text: "Button"
})
buttonDisabled.disabled = true;

const buttonText = Button({
    text: "Button",
    style: "text"
})
const buttonTextDisabled = Button({
    text: "Button",
    style: "text"
})
buttonTextDisabled.disabled = true;

const buttonIconSmall = Button({
    style: "icon-small",
    iconLeft: "Arrow"
})
const buttonIconLarge = Button({
    style: "icon-large",
    iconLeft: "Arrow"
})

const buttonGroup = ButtonGroup([
    Button({
        iconLeft: "Git",
        iconRight: "Git",
        text: "Button"
    }),
    Button({
        iconLeft: "Git",
        iconRight: "Git",
        text: "Button"
    }),
    Button({
        iconLeft: "Git",
        iconRight: "Git",
        text: "Button",
        color: "red"
    })
])

document.body.append(
    buttonDefault,
    buttonDanger,
    buttonDisabled,
    buttonText,
    buttonTextDisabled,
    buttonIconSmall,
    buttonIconLarge,
    buttonGroup
);

// Inputs
const form = document.createElement("form");

const inputText = InputText({
    label: "Input Label"
});

const inputFile = InputFile({
    label: "Input Label",
});

const inputSwitch = InputSwitch({
    label: "Input Label"
})

const inputRadio = InputRadio();
const inputCheckbox = InputCheckbox();

form.append(
    inputText.container, 
    inputFile.container,
    inputSwitch.container,
    inputRadio.container,
    inputCheckbox.container
);

const resetButton = Button({
    text: "Reset"
});
resetButton.onclick = () => form.reset();

document.body.append(form, resetButton);