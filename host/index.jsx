// Copy and PASTA — camada de integração com o Premiere Pro (ExtendScript / CEP host script)
//
// Responsável por:
//  1. Importar um arquivo de imagem para o projeto ativo.
//  2. Inserir esse item na sequência ativa, na posição atual do playhead,
//     numa faixa de vídeo que não tenha nenhum clipe naquele ponto — para
//     nunca cortar ou sobrepor conteúdo existente. Se nenhuma faixa
//     existente servir, uma nova faixa de vídeo é criada automaticamente.
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

        var playerPosition = seq.getPlayerPosition();
        var positionSeconds = parseFloat(playerPosition.seconds);

        var videoTrack = pasta_findAvailableVideoTrack(seq, positionSeconds);
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

        videoTrack.insertClip(newItem, playerPosition.ticks);

        return JSON.stringify({ success: true });
    } catch (e) {
        return JSON.stringify({ success: false, error: "EXCEPTION", message: String(e) });
    }
}

function pasta_isLocked(track) {
    try {
        return track.isLocked();
    } catch (e) {
        return false;
    }
}

function pasta_isTrackEmpty(track) {
    try {
        return track.clips.numItems === 0;
    } catch (e) {
        return true;
    }
}

// Verifica se a posição (em segundos) cai num trecho vazio da faixa,
// ou seja, sem nenhum clipe cobrindo esse ponto — inserir ali não corta
// nem sobrepõe nada.
function pasta_hasGapAtPosition(track, positionSeconds) {
    try {
        for (var i = 0; i < track.clips.numItems; i++) {
            var clip = track.clips[i];
            var start = parseFloat(clip.start.seconds);
            var end = parseFloat(clip.end.seconds);
            if (positionSeconds >= start && positionSeconds < end) {
                return false;
            }
        }
        return true;
    } catch (e) {
        return true;
    }
}

function pasta_findAvailableVideoTrack(seq, positionSeconds) {
    var t;

    // 1) Preferir uma faixa totalmente vazia.
    for (t = 0; t < seq.videoTracks.numTracks; t++) {
        var emptyTrack = seq.videoTracks[t];
        if (!pasta_isLocked(emptyTrack) && pasta_isTrackEmpty(emptyTrack)) {
            return emptyTrack;
        }
    }

    // 2) Senão, uma faixa com espaço livre exatamente na posição do playhead.
    for (t = 0; t < seq.videoTracks.numTracks; t++) {
        var gapTrack = seq.videoTracks[t];
        if (!pasta_isLocked(gapTrack) && pasta_hasGapAtPosition(gapTrack, positionSeconds)) {
            return gapTrack;
        }
    }

    // 3) Última opção: criar uma nova faixa de vídeo vazia.
    try {
        var added = seq.addTracks(1, seq.videoTracks.numTracks, 0, 0, 0);
        if (added) {
            return seq.videoTracks[seq.videoTracks.numTracks - 1];
        }
    } catch (e) {}

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
