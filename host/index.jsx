// Copy and PASTA — camada de integração com o Premiere Pro (ExtendScript / CEP host script)
//
// Responsável por:
//  1. Importar um arquivo de imagem para o projeto ativo.
//  2. Inserir esse item na sequência ativa, na posição atual do playhead,
//     na primeira faixa de vídeo disponível (não travada), sem sobrescrever
//     clipes existentes (ripple insert).
//
// Chamado a partir do painel via CSInterface.evalScript("pasta_importAndInsert(\"<path>\")").

function pasta_importAndInsert(filePath) {
    try {
        if (!app.project) {
            return JSON.stringify({ success: false, error: "NO_PROJECT" });
        }

        var seq = app.project.activeSequence;
        if (!seq) {
            return JSON.stringify({ success: false, error: "NO_SEQUENCE" });
        }

        var videoTrack = pasta_findAvailableVideoTrack(seq);
        if (!videoTrack) {
            return JSON.stringify({ success: false, error: "NO_VIDEO_TRACK" });
        }

        // suppressUI = true: nunca deve abrir diálogos de import.
        var importOk = app.project.importFiles(
            [filePath],
            true,
            app.project.rootItem,
            false
        );
        if (!importOk) {
            return JSON.stringify({ success: false, error: "IMPORT_FAILED" });
        }

        var newItem = pasta_findItemByPath(app.project.rootItem, filePath);
        if (!newItem) {
            return JSON.stringify({ success: false, error: "IMPORT_FAILED" });
        }

        var playerPosition = seq.getPlayerPosition();
        videoTrack.insertClip(newItem, playerPosition.ticks);

        return JSON.stringify({ success: true });
    } catch (e) {
        return JSON.stringify({ success: false, error: "EXCEPTION", message: String(e) });
    }
}

function pasta_findAvailableVideoTrack(seq) {
    for (var t = 0; t < seq.videoTracks.numTracks; t++) {
        var track = seq.videoTracks[t];
        try {
            if (!track.isLocked()) {
                return track;
            }
        } catch (e) {
            // Se isLocked() não estiver disponível por algum motivo,
            // assume-se que a faixa está utilizável.
            return track;
        }
    }
    return null;
}

function pasta_findItemByPath(bin, filePath) {
    for (var i = 0; i < bin.children.numItems; i++) {
        var child = bin.children[i];
        try {
            if (child.getMediaPath && child.getMediaPath() === filePath) {
                return child;
            }
        } catch (e) {}
        if (child.children && (!child.getMediaPath || !child.getMediaPath())) {
            var found = pasta_findItemByPath(child, filePath);
            if (found) {
                return found;
            }
        }
    }
    return null;
}
