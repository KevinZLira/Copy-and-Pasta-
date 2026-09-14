-- Copy and PASTA — leitor de imagem da clipboard no macOS.
--
-- Uso: osascript mac-clipboard.applescript <caminho-base-sem-extensao>
--
-- Tenta ler a clipboard em ordem de formatos mais comuns (PNG, JPEG, TIFF)
-- e grava o primeiro que existir em "<caminho-base>.<ext>".
--
-- Saida em stdout:
--   "OK:png" | "OK:jpg" | "OK:tiff"  -> sucesso, arquivo escrito com essa extensao
--   "NO_IMAGE"                       -> nao ha imagem na clipboard

on run argv
    if (count of argv) is 0 then
        return "NO_IMAGE"
    end if
    set basePath to item 1 of argv

    try
        set imgData to the clipboard as «class PNGf»
        return my writeImage(imgData, basePath & ".png", "png")
    end try

    try
        set imgData to the clipboard as JPEG picture
        return my writeImage(imgData, basePath & ".jpg", "jpg")
    end try

    try
        set imgData to the clipboard as TIFF picture
        return my writeImage(imgData, basePath & ".tiff", "tiff")
    end try

    return "NO_IMAGE"
end run

on writeImage(imgData, outFile, tag)
    try
        set fileRef to open for access (POSIX file outFile) with write permission
        set eof fileRef to 0
        write imgData to fileRef
        close access fileRef
        return "OK:" & tag
    on error errMsg
        try
            close access (POSIX file outFile)
        end try
        return "NO_IMAGE"
    end try
end writeImage
