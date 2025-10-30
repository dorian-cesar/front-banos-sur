let tecladoVirtual = (function () {
  let keyboard = null;
  let inputActivo = null;
  let layoutActual = "default";
  const contenedorID = "tecladoContainer";

  function inicializar() {
    const container = document.getElementById(contenedorID);
    if (!container) {
      console.error(`[tecladoVirtual] No se encontró el div con id "${contenedorID}"`);
      return;
    }

    const Keyboard = window.SimpleKeyboard.default;
    keyboard = new Keyboard({
      onChange: input => {
        if (inputActivo) inputActivo.value = input;
      },
      onKeyPress: handleKeyPress,
      layout: {
        default: [
          "1 2 3 4 5 6 7 8 9 0",
          "q w e r t y u i o p",
          "a s d f g h j k l ñ",
          "z x c v b n m . @ _",
          "{shift} {space} {bksp}"
        ],
        shift: [
          "1 2 3 4 5 6 7 8 9 0",
          "Q W E R T Y U I O P",
          "A S D F G H J K L Ñ",
          "Z X C V B N M , ; :",
          "{shift} {space} {bksp}"
        ]
      },
      display: {
        "{bksp}": "⌫",
        "{space}": "⎵",
        "{shift}": "⇪"
      }
    });

    document.addEventListener("click", (e) => {
      const esInput = e.target.classList.contains("usar-teclado");
      const esTeclado = container.contains(e.target);
      if (!esInput && !esTeclado) {
        ocultar();
      }
    });
  }

  function handleKeyPress(button) {
    if (!inputActivo) return;

    if (button === "{bksp}") {
      const nuevoValor = inputActivo.value.slice(0, -1);
      inputActivo.value = nuevoValor;
      keyboard.setInput(nuevoValor);
    }

    if (button === "{space}") {
      const nuevoValor = inputActivo.value + " ";
      inputActivo.value = nuevoValor;
      keyboard.setInput(nuevoValor);
    }

    if (button === "{shift}") {
      layoutActual = layoutActual === "default" ? "shift" : "default";
      keyboard.setOptions({ layoutName: layoutActual });
    }
  }

  function mostrar(inputElement) {
    inputActivo = inputElement;
    keyboard.setInput(inputElement.value || "");
    document.getElementById(contenedorID).style.display = "block";
  }

  function ocultar() {
    document.getElementById(contenedorID).style.display = "none";
    inputActivo = null;
  }

  return {
    init: inicializar,
    show: mostrar,
    hide: ocultar
  };
})();
