# Copy and PASTA — leitor de imagem da clipboard no Windows.
#
# Uso: powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File win-clipboard.ps1 <caminho-de-saida.png>
#
# Saida em stdout:
#   "OK"        -> imagem salva com sucesso em <caminho-de-saida.png>
#   "NO_IMAGE"  -> nao ha imagem na clipboard
# Codigo de saida: 0 = sucesso, 2 = sem imagem, 1 = erro inesperado.

param(
    [Parameter(Mandatory = $true)]
    [string]$OutFile
)

try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    if (-not [System.Windows.Forms.Clipboard]::ContainsImage()) {
        Write-Output "NO_IMAGE"
        exit 2
    }

    $img = [System.Windows.Forms.Clipboard]::GetImage()
    if ($null -eq $img) {
        Write-Output "NO_IMAGE"
        exit 2
    }

    $img.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "OK"
    exit 0
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
    exit 1
}
