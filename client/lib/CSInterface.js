/**
 * Copy and PASTA — subconjunto mínimo do CSInterface (biblioteca padrão da
 * Adobe para extensões CEP) com apenas o necessário para este plugin:
 * executar ExtendScript no host (Premiere Pro) e resolver caminhos do
 * sistema/da própria extensão.
 *
 * Baseado na API pública documentada pela Adobe para CEP (Common
 * Extensibility Platform); não é uma cópia do arquivo distribuído pela
 * Adobe, apenas uma reimplementação enxuta das funções usadas aqui.
 */
function CSInterface() {}

CSInterface.SystemPath = {
    USER_DATA: "userData",
    COMMON_FILES: "commonFiles",
    MY_DOCUMENTS: "myDocuments",
    APPLICATION: "application",
    EXTENSION: "extension",
    HOST_APPLICATION: "hostApplication"
};

/**
 * Executa um script ExtendScript no host (Premiere Pro) e retorna o
 * resultado via callback.
 */
CSInterface.prototype.evalScript = function (script, callback) {
    if (!callback) {
        callback = function () {};
    }
    if (typeof window.__adobe_cep__ === "undefined") {
        callback(JSON.stringify({ success: false, error: "NO_CEP_RUNTIME" }));
        return;
    }
    window.__adobe_cep__.evalScript(script, callback);
};

/**
 * Retorna o caminho absoluto no sistema de arquivos para o tipo pedido
 * (ex.: a pasta raiz desta própria extensão).
 */
CSInterface.prototype.getSystemPath = function (pathType) {
    var path = "";
    try {
        path = window.__adobe_cep__.getSystemPath(pathType);
        path = decodeURI(path);
        var os = this.getOSInformation();
        if (os.indexOf("Windows") >= 0) {
            path = path.replace("file:///", "");
        } else {
            path = path.replace("file://", "");
        }
    } catch (e) {
        path = "";
    }
    return path;
};

CSInterface.prototype.getOSInformation = function () {
    var userAgent = navigator.userAgent;
    if (userAgent.indexOf("Windows") >= 0) {
        return "Windows";
    } else if (userAgent.indexOf("Macintosh") >= 0 || userAgent.indexOf("Mac OS") >= 0) {
        return "Mac";
    }
    return "Unknown";
};
