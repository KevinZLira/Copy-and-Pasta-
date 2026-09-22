# Copy and PASTA — leitor de imagem da clipboard no Windows.
#
# Uso: powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File win-clipboard.ps1 <caminho-base-sem-extensao>
#
# Prioriza um arquivo de verdade copiado (Ctrl+C num arquivo no Explorer),
# preservando o formato original (gif animado, webp, etc.). Em seguida
# tenta os bytes crus de PNG que o app de origem também costuma colocar na
# clipboard (formato "PNG"), que preservam transparência corretamente. Só
# cai para o Bitmap genérico do .NET por último, pois esse caminho NÃO
# preserva canal alfa (o fundo transparente vira preto).
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

    $dataObj = [System.Windows.Forms.Clipboard]::GetDataObject()

    if ($null -ne $dataObj -and $dataObj.GetDataPresent("PNG")) {
        $pngStream = $dataObj.GetData("PNG")
        if ($pngStream -is [System.IO.Stream]) {
            $pngFile = "$BasePath.png"
            $bytes = New-Object byte[] $pngStream.Length
            $pngStream.Read($bytes, 0, $pngStream.Length) | Out-Null
            [System.IO.File]::WriteAllBytes($pngFile, $bytes)
            Write-Output "OK:png"
            exit 0
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
