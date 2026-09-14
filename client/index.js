/**
 * Copy and PASTA — lógica do painel.
 *
 * Fluxo do botão PASTA:
 *   1. Roda um helper nativo (PowerShell no Windows, AppleScript no macOS)
 *      que lê a imagem atual da área de transferência e grava em um arquivo
 *      temporário.
 *   2. Chama o ExtendScript no Premiere para importar esse arquivo para o
 *      projeto e inseri-lo na sequência ativa, na posição do playhead.
 *   3. Mostra uma mensagem curta de sucesso/erro (sem diálogos).
 *
 * Requer Node.js integration habilitada no manifest (CSXS) para acessar
 * child_process/fs/os/path diretamente no contexto da página.
 */
(function () {
    "use strict";

    var execFile = require("child_process").execFile;
    var os = require("os");
    var path = require("path");
    var fs = require("fs");

    var csInterface = new CSInterface();
    var button = document.getElementById("pasta-btn");
    var toast = document.getElementById("toast");
    var toastTimer = null;
    var busy = false;

    function showToast(message, isError) {
        toast.textContent = message;
        toast.className = "toast show" + (isError ? " error" : "");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            toast.className = "toast";
        }, 2600);
    }

    function setBusy(state) {
        busy = state;
        button.disabled = state;
        button.classList.toggle("busy", state);
    }

    function getExtensionRoot() {
        var extRoot = csInterface.getSystemPath(CSInterface.SystemPath.EXTENSION);
        if (extRoot) {
            return extRoot;
        }
        // Fallback: assume que este arquivo está em <root>/client/index.js
        return path.join(__dirname, "..");
    }

    /**
     * Lê a imagem da clipboard via helper nativo e retorna o caminho do
     * arquivo temporário criado. Rejeita com Error("NO_IMAGE") se não
     * houver imagem, ou outro erro em caso de falha inesperada.
     */
    function getClipboardImagePath() {
        return new Promise(function (resolve, reject) {
            var platform = os.platform();
            var extRoot = getExtensionRoot();
            var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "copy-and-pasta-"));

            if (platform === "win32") {
                var outFile = path.join(tmpDir, "clip.png");
                var psScript = path.join(extRoot, "native", "win-clipboard.ps1");
                execFile(
                    "powershell.exe",
                    [
                        "-NoProfile",
                        "-ExecutionPolicy",
                        "Bypass",
                        "-STA",
                        "-File",
                        psScript,
                        outFile
                    ],
                    { timeout: 10000 },
                    function (err, stdout) {
                        var out = (stdout || "").trim();
                        if (out.indexOf("OK") === 0 && fs.existsSync(outFile)) {
                            resolve(outFile);
                        } else if (out.indexOf("NO_IMAGE") === 0) {
                            reject(new Error("NO_IMAGE"));
                        } else {
                            reject(new Error("CLIPBOARD_ERROR"));
                        }
                    }
                );
            } else if (platform === "darwin") {
                var basePath = path.join(tmpDir, "clip");
                var scpt = path.join(extRoot, "native", "mac-clipboard.applescript");
                execFile("osascript", [scpt, basePath], { timeout: 10000 }, function (err, stdout) {
                    var out = (stdout || "").trim();
                    if (out.indexOf("OK:") === 0) {
                        var ext = out.split(":")[1];
                        var outFile2 = basePath + "." + ext;
                        if (fs.existsSync(outFile2)) {
                            resolve(outFile2);
                        } else {
                            reject(new Error("CLIPBOARD_ERROR"));
                        }
                    } else {
                        reject(new Error("NO_IMAGE"));
                    }
                });
            } else {
                reject(new Error("UNSUPPORTED_PLATFORM"));
            }
        });
    }

    function insertIntoTimeline(filePath) {
        return new Promise(function (resolve) {
            var escaped = filePath.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
            csInterface.evalScript('pasta_importAndInsert("' + escaped + '")', function (result) {
                resolve(result);
            });
        });
    }

    function errorMessage(code) {
        switch (code) {
            case "NO_PROJECT":
                return "Abra um projeto no Premiere.";
            case "NO_SEQUENCE":
                return "Abra uma sequência para usar o PASTA.";
            case "NO_VIDEO_TRACK":
                return "Nenhuma faixa de vídeo disponível.";
            case "IMPORT_FAILED":
                return "Não foi possível importar a imagem.";
            case "UNSUPPORTED_PLATFORM":
                return "Sistema operacional não suportado.";
            default:
                return "Ocorreu um erro ao colar a imagem.";
        }
    }

    function handlePasteClick() {
        if (busy) {
            return;
        }
        setBusy(true);

        getClipboardImagePath()
            .then(function (imagePath) {
                return insertIntoTimeline(imagePath);
            })
            .then(function (rawResult) {
                var result;
                try {
                    result = JSON.parse(rawResult);
                } catch (e) {
                    result = { success: false, error: "HOST_ERROR" };
                }

                if (result.success) {
                    showToast("Colado na timeline");
                } else {
                    showToast(errorMessage(result.error), true);
                }
            })
            .catch(function (err) {
                if (err && err.message === "NO_IMAGE") {
                    showToast("Nenhuma imagem encontrada na área de transferência.", true);
                } else {
                    showToast("Não foi possível colar a imagem.", true);
                }
            })
            .then(function () {
                setBusy(false);
            });
    }

    button.addEventListener("click", handlePasteClick);
})();
