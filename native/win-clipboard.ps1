# Copy and PASTA — leitor de imagem da clipboard no Windows.
#
# Uso: powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File win-clipboard.ps1 <caminho-base-sem-extensao>
#
# Prioriza um arquivo de verdade copiado (Ctrl+C num arquivo no Explorer),
# preservando o formato original (gif animado, webp, etc.). Só cai para
# bitmap genérico (salvo como PNG) quando a clipboard tem apenas dados de
# imagem "crus" (ex.: "Copiar imagem" em um navegador).
#
# Saida em stdout:
#   "OK:<ext>"  -> imagem salva em <caminho-base>.<ext>
#   "NO_IMAGE"  -> nao ha imagem na clipboard
# Codigo de saida: 0 = sucesso, 2 = sem imagem, 1 = erro inesperado.

param(
    [Parameter(Mandatory = $true)]
    [string]$BasePath
)

try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $supportedExtensions = @(".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tif", ".tiff", ".webp")

    if ([System.Windows.Forms.Clipboard]::ContainsFileDropList()) {
        $files = [System.Windows.Forms.Clipboard]::GetFileDropList()
        foreach ($f in $files) {
            $ext = [System.IO.Path]::GetExtension($f).ToLowerInvariant()
            if ($supportedExtensions -contains $ext -and (Test-Path -LiteralPath $f)) {
                $destFile = "$BasePath$ext"
                Copy-Item -LiteralPath $f -Destination $destFile -Force
                Write-Output "OK:$($ext.TrimStart('.'))"
                exit 0
            }
        }
    }

    if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
        $img = [System.Windows.Forms.Clipboard]::GetImage()
        if ($null -ne $img) {
            $pngFile = "$BasePath.png"
            $img.Save($pngFile, [System.Drawing.Imaging.ImageFormat]::Png)
            Write-Output "OK:png"
            exit 0
        }
    }

    Write-Output "NO_IMAGE"
    exit 2
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
    exit 1
}
