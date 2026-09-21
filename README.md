# Copy and PASTA

Um painel para o Adobe Premiere Pro com um único botão: **PASTA**.

Copie uma imagem de qualquer lugar (navegador, Discord, Pinterest, Finder/Explorer...) com `Ctrl+C`/`Cmd+C`, abra o Premiere, clique em **PASTA** e a imagem entra direto no projeto e na timeline, na posição atual do playhead.

```
┌─────────────────┐
│                 │
│      PASTA      │
│                 │
└─────────────────┘
```

---

## 1. Análise técnica (feita antes de implementar)

### 1.1 Como o Premiere permite importar um arquivo e colocá-lo na timeline

O Premiere Pro expõe um DOM de scripting via **ExtendScript** (arquivos `.jsx` carregados por uma extensão CEP), documentado no *Premiere Pro Scripting Guide* da Adobe. As peças relevantes:

- `app.project.importFiles(fileList, suppressUIFlag, targetBin, importAsNumberedStillsFlag)` — importa arquivo(s) do disco para o painel de projeto, com `suppressUIFlag = true` para não abrir nenhum diálogo.
- `app.project.rootItem` / `ProjectItem.children` — permite localizar o `ProjectItem` recém-importado (buscando por `getMediaPath()` igual ao caminho do arquivo importado).
- `app.project.activeSequence` — a sequência ativa; se `undefined`, não há timeline aberta.
- `sequence.getPlayerPosition()` — retorna um objeto `Time` com a posição atual do playhead (`.ticks`).
- `sequence.videoTracks[i]` — cada `Track` tem `isLocked()`, `clips` (com `.start`/`.end` de cada `TrackItem`) e o método **`insertClip(projectItem, time)`**, que insere o clipe na posição indicada empurrando (ripple insert) o conteúdo posterior **daquela faixa**, sem sobrescrever nada — ao contrário de `overwriteClip()`. Para não cortar/sobrepor um clipe já existente na própria faixa, o plugin escolhe a faixa (ver seção 6) antes de inserir, em vez de sempre usar a primeira faixa disponível.
- A **duração padrão de still image** (Preferências → Timeline) é aplicada automaticamente pelo próprio Premiere no momento da importação/criação do `ProjectItem`, então não é necessário calculá-la manualmente.

Isso cobre 100% do que o plugin precisa fazer dentro do Premiere: importar + inserir no playhead + respeitar faixas bloqueadas + não apagar clipes.

### 1.2 Como acessar a clipboard no Windows

Nem ExtendScript nem CEP (JavaScript rodando em Chromium) têm uma API para ler **imagens binárias** da área de transferência do sistema — a Clipboard API do navegador (`navigator.clipboard.read()`) até existe, mas dentro do CEF do CEP seu suporte é inconsistente entre versões e não é uma dependência confiável para um plugin de produção.

Solução: usar o **.NET Framework via PowerShell**, sempre presente no Windows, através de `System.Windows.Forms.Clipboard.GetImage()`. O script (`native/win-clipboard.ps1`) salva a imagem como PNG em um arquivo temporário e informa sucesso/ausência de imagem via stdout + exit code.

### 1.3 Como acessar a clipboard no macOS

No macOS, o caminho equivalente é **AppleScript** (sempre disponível via `osascript`, sem instalação extra), lendo `the clipboard as «class PNGf»` (e, como fallback, `JPEG picture`/`TIFF picture`, formatos que aplicativos diferentes colocam na clipboard). O script (`native/mac-clipboard.applescript`) grava o primeiro formato compatível encontrado em disco.

### 1.4 Uma extensão/plugin do Premiere consegue fazer isso diretamente?

Não sozinha. Nem CEP nem a UXP mais recente para Premiere Pro expõem uma API nativa e confiável para **ler imagens binárias da área de transferência do SO** (elas lidam bem com texto, mas não com bitmaps arbitrários vindos de qualquer aplicativo). Por isso o plugin precisa de uma **camada auxiliar nativa** por sistema operacional — é exatamente o padrão recomendado pela própria Adobe para CEP: extensões podem rodar processos externos (via Node.js `child_process`, habilitado no manifest) para tarefas que o sandbox do painel não alcança.

### 1.5 Arquitetura escolhida

**CEP (Common Extensibility Platform) com Node.js integration + ExtendScript**, em vez de UXP:

- A UXP para Premiere Pro (ainda em evolução) tem cobertura parcial da API de projeto/timeline e, no momento desta implementação, não expõe de forma estável tudo que é necessário (inserção em faixa específica respeitando trava, busca de `ProjectItem` por caminho, etc.). O DOM de ExtendScript via CEP é a via madura e documentada para esse fluxo.
- Node.js integration (flag `--enable-nodejs` no manifest) dá acesso direto a `child_process`, `fs`, `os` e `path` no próprio JS do painel, sem precisar de um processo servidor separado — o suficiente para chamar os helpers nativos e gerenciar o arquivo temporário.
- Fluxo completo: **painel HTML/JS (CEP) → helper nativo (PowerShell/AppleScript) → arquivo temporário → ExtendScript (`app.project.importFiles` + `track.insertClip`)**.

### 1.6 Limitações conhecidas

- Os helpers nativos primeiro checam se a clipboard tem um **arquivo de verdade** (ex.: `Ctrl+C`/`Cmd+C` num arquivo no Explorer/Finder) e, nesse caso, preservam o formato original — inclusive GIF animado e WebP. Só caem para um bitmap genérico salvo como PNG quando a clipboard só tem dados de imagem "crus" (ex.: "Copiar imagem" em um navegador).
- **Importante:** quando a imagem vem de "Copiar imagem" num navegador (em vez de copiar o arquivo em si), o próprio navegador normalmente já rasteriza a imagem em um bitmap estático antes de colocá-la na clipboard — isso é comportamento do navegador/SO, fora do controle do plugin, e faz o GIF perder a animação e nunca aparecer como WebP nesse caminho.
- O Premiere Pro **não tem suporte nativo a importação de WebP** — mesmo que o arquivo original seja preservado corretamente pelo plugin, o `importFiles` do Premiere pode falhar (`IMPORT_FAILED`) para esse formato. GIF é suportado nativamente pelo Premiere.
- Requer que Node.js integration esteja habilitada (`--enable-nodejs`), disponível em Premiere Pro que suporte CSXS 9 (Premiere Pro CC 2020 em diante). Para versões mais antigas, ajuste `RequiredRuntime` no manifest — mas o acesso a `child_process` pode se comportar de forma diferente.
- A busca do `ProjectItem` recém-importado é feita comparando `getMediaPath()`; como cada clique gera um arquivo temporário com nome único, isso é confiável na prática.
- O plugin não lê imagens vindas de outra instância do próprio Premiere (ex. copiar um clipe da timeline) — o escopo é apenas imagens de outros aplicativos/SO, como pedido.

---

## 2. Estrutura do projeto

```
Copy-and-Pasta-/
├── CSXS/
│   └── manifest.xml          # Manifesto da extensão CEP
├── client/                   # Painel (UI)
│   ├── index.html
│   ├── index.js               # Lógica: clipboard → import → insert
│   ├── style.css
│   └── lib/
│       └── CSInterface.js     # Subconjunto mínimo da API CEP (evalScript, getSystemPath)
├── host/
│   └── index.jsx              # ExtendScript: importa e insere na timeline
├── native/
│   ├── win-clipboard.ps1      # Leitor de clipboard (Windows)
│   └── mac-clipboard.applescript  # Leitor de clipboard (macOS)
├── .debug                     # Configuração de debug remoto do CEP (dev)
└── README.md
```

---

## 3. Instalação (modo desenvolvedor)

Extensões CEP não assinadas só rodam com o **PlayerDebugMode** ativado.

### Windows

1. Habilite o modo debug (uma vez, via `regedit` ou PowerShell como usuário normal):
   ```powershell
   New-Item -Path "HKCU:\Software\Adobe\CSXS.9" -Force
   Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.9" -Name PlayerDebugMode -Value 1
   ```
   (repita para `CSXS.8`, `CSXS.10` etc. se necessário, conforme a versão do Premiere.)
2. Copie (ou crie um link simbólico para) a pasta deste projeto para:
   ```
   %APPDATA%\Adobe\CEP\extensions\com.copyandpasta.panel
   ```
3. Abra o Premiere Pro → `Janela → Extensões → Copy and PASTA`.

### macOS

1. Habilite o modo debug:
   ```bash
   defaults write com.adobe.CSXS.9 PlayerDebugMode 1
   ```
2. Copie (ou faça symlink) a pasta do projeto para:
   ```
   ~/Library/Application Support/Adobe/CEP/extensions/com.copyandpasta.panel
   ```
3. Abra o Premiere Pro → `Window → Extensions → Copy and PASTA`.

> Ajuste `CSXS.9` para a versão de runtime correspondente à sua versão do Premiere se necessário (visível no `RequiredRuntime` de `CSXS/manifest.xml`).

---

## 4. Desenvolvimento / build

Não há passo de build: é HTML/CSS/JS puro + ExtendScript, carregado diretamente pelo CEP. Para desenvolver:

1. Edite os arquivos em `client/`, `host/` ou `native/`.
2. Fixe o painel do Premiere (feche e reabra a extensão, ou use `Ctrl+R`/`Cmd+R` dentro do painel se disponível) para recarregar o JS/HTML.
3. Para depurar o painel com DevTools do Chromium: com `.debug` presente, abra `http://localhost:8090` no Chrome enquanto o painel estiver aberto no Premiere.
4. Para depurar o `host/index.jsx`, use o **ExtendScript Toolkit**/**Visual Studio Code + extensão ExtendScript Debugger** anexando ao processo do Premiere, ou insira `$.writeln()` temporários (removidos antes de finalizar).

### Empacotamento (distribuição)

Para distribuir fora do modo debug, assine a extensão como `.zxp` com o `ZXPSignCmd` da Adobe (não incluso neste repositório) e instale via um instalador CEP (ex. ExManCmd/ZXPInstaller). Isso é opcional — não é necessário para uso pessoal/dev.

---

## 5. Como testar

### Windows

1. Copie uma imagem (ex. no navegador: clique direito em uma imagem → "Copiar imagem").
2. No Premiere, abra um projeto com uma sequência ativa, posicione o playhead onde quiser.
3. Clique em **PASTA** no painel.
4. A imagem deve aparecer no painel de projeto e na timeline, na posição do playhead, na primeira faixa de vídeo não bloqueada.

Casos de erro para validar:
- Clipboard sem imagem → mensagem "Nenhuma imagem encontrada na área de transferência."
- Sem sequência ativa → mensagem "Abra uma sequência para usar o PASTA."
- Todas as faixas de vídeo bloqueadas → mensagem "Nenhuma faixa de vídeo disponível."

### macOS

1. Copie uma imagem (Safari/Chrome: clique direito → "Copiar Imagem"; ou `Cmd+C` em uma imagem no Finder/Preview).
2. Repita os mesmos passos e casos de teste do Windows acima.

---

## 6. Comportamento por design

- Um único botão, sem seletor de arquivo, sem diálogo de import, sem drag-and-drop.
- Nunca sobrescreve clipes existentes (usa `insertClip`, não `overwriteClip`) e nunca corta um clipe ao meio: a faixa de destino é escolhida em ordem de preferência — (1) uma faixa de vídeo totalmente vazia, (2) uma faixa com espaço livre exatamente na posição do playhead, (3) uma nova faixa de vídeo criada automaticamente se nenhuma das anteriores servir.
- Nunca trava a UI com diálogos — todo feedback é uma mensagem curta (toast) de ~2.5s.
- Arquivos temporários são criados em uma pasta única por clique dentro do diretório temporário do SO (`os.tmpdir()`), sem necessidade de limpeza manual pelo usuário.
