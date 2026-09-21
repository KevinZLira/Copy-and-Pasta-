-- Copy and PASTA — leitor de imagem da clipboard no macOS.
--
-- Uso: osascript mac-clipboard.applescript <caminho-base-sem-extensao>
--
-- Prioriza um arquivo de verdade copiado (Cmd+C num arquivo no Finder),
-- preservando o formato original (gif animado, webp, etc.). Só cai para
-- bitmap genérico (PNG/JPEG/TIFF) quando a clipboard tem apenas dados de
-- imagem "crus" (ex.: "Copiar Imagem" em um navegador).
--
-- Saida em stdout:
--   "OK:<ext>"  -> arquivo escrito em "<caminho-base>.<ext>"
--   "NO_IMAGE"  -> nao ha imagem na clipboard

on run argv
    if (count of argv) is 0 then
        return "NO_IMAGE"
    end if
    set basePath to item 1 of argv

    -- 1) Arquivo de verdade na clipboard (preserva formato original)
    try
        set fileRef to (the clipboard as «class furl»)
        set posixPath to POSIX path of fileRef
        set ext to my getSupportedExtension(posixPath)
        if ext is not "" then
            set outFile to basePath & "." & ext
            do shell script "cp " & quoted form of posixPath & " " & quoted form of outFile
            return "OK:" & ext
        end if
    end try

    -- 2) Fallback: dados de imagem "crus" na clipboard
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

on getSupportedExtension(posixPath)
    set supported to {"png", "jpg", "jpeg", "gif", "bmp", "tif", "tiff", "webp"}
    set AppleScript's text item delimiters to "."
    set parts to text items of posixPath
    set AppleScript's text item delimiters to ""
    if (count of parts) < 2 then
        return ""
    end if
    set rawExt to my toLower(item -1 of parts)
    if supported contains rawExt then
        return rawExt
    end if
    return ""
end getSupportedExtension

on toLower(txt)
    set lowChars to "abcdefghijklmnopqrstuvwxyz"
    set upChars to "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    set result to ""
    repeat with c in txt
        set i to offset of (c as string) in upChars
        if i > 0 then
            set result to result & character i of lowChars
        else
            set result to result & c
        end if
    end repeat
    return result
end toLower

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
