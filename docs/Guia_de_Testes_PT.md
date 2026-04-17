# Guia de Testes — JukeBox

Procedimento completo de testes para a plataforma JukeBox em **https://jukjoy.com**.

## Contas de Teste

| Função | Email | Senha |
|--------|-------|-------|
| Administrador | admin@jukebox.com | password123 |
| Dono do Bar 1 | carlos@bar1.com | password123 |
| Dono do Bar 2 | ana@bar2.com | password123 |
| Cliente | joao@test.com | password123 |
| Funcionário | lucas@jukebox.com | password123 |
| Afiliado | rafael@promo.com | password123 |

---

## PARTE 1 — Acesso Público e Idioma

### Teste 1.1 — Página inicial sem login
1. Abra **https://jukjoy.com** no navegador (ou em aba anônima)
2. Verifique: A página de navegação carrega imediatamente (sem tela de login)
3. Veja: Logo JukeBox (topo esquerdo), botão de idioma + Login (topo direito)
4. Veja: Barra de busca, filtros de gênero, grade de músicas, seção de produtos especiais
5. **✅ Aprovado** — Nenhum login necessário

### Teste 1.2 — Alternar idioma
1. Na página inicial, clique no botão **🇺🇸 EN** no topo direito
2. Ele muda para **🇧🇷 PT** (bandeira do Brasil)
3. O texto da página muda para português:
   - "Login / Register" → "Entrar / Cadastrar"
   - "Special Features" → "Recursos Especiais"
   - "Request a Song" → "Pedir uma Música"
4. Clique novamente → volta para EN
5. Atualize a página → a preferência de idioma é lembrada

### Teste 1.3 — Navegar músicas sem login
1. Na página inicial, role a lista de músicas (10 músicas)
2. Clique em qualquer música → abre o modal com detalhes
3. Clique em "Tocar para ouvir" → prévia de áudio toca
4. Feche o modal → nenhum erro

---

## PARTE 2 — Jornada do Cliente (Fluxo Completo)

### Teste 2.1 — Login
1. Clique no botão **Entrar / Cadastrar** no topo direito
2. Página de login abre (com botão Google Sign-In se configurado)
3. Entre com `joao@test.com` / `password123` → clique em "Entrar no JukeBox"
4. Redirecionado para a página inicial, agora mostra o avatar do usuário no topo direito

### Teste 2.2 — Buscar músicas
1. Digite "Hero" na barra de busca
2. Apenas "Hero" de Donnie Sands aparece
3. Limpe a busca → as 10 músicas voltam
4. Clique no filtro **Rock** → apenas músicas Rock aparecem
5. Clique em **Todos** → todas as músicas voltam

### Teste 2.3 — Pedir uma música
1. Role até a seção "Pedir uma Música"
2. Clique → modal abre
3. Digite: Título "Evidências", Artista "Chitãozinho e Xororó"
4. Clique em "Enviar Pedido"
5. Mensagem de sucesso aparece → modal fecha

### Teste 2.4 — Bot de busca de músicas
1. Clique no **botão flutuante rosa com nota musical** (canto inferior direito)
2. Modal de chat abre
3. Digite "blues" → pressione Enter
4. O bot mostra resultados do Internet Archive
5. Clique em "+ Adicionar" em uma música → ela é adicionada ao catálogo

### Teste 2.5 — Conectar ao bar
1. Clique em qualquer música → modal de pagamento abre
2. Clique em "Adicionar à Fila" → modal de conexão com bar aparece
3. Digite **BAR-CARLOS** → clique em Conectar
4. Modal fecha, agora conectado

### Teste 2.6 — Adicionar créditos via Pix (Sandbox)
1. Clique na aba **Carteira** na navegação inferior
2. Clique em "Adicionar Créditos"
3. Selecione o método de pagamento **Pix**
4. Clique no botão **R$ 5**
5. QR code + código copia-e-cola aparecem
6. Clique em **"[SANDBOX] Simular Pagamento"**
7. O saldo atualiza para +R$ 5

### Teste 2.7 — Pagar com carteira
1. Volte para a aba **Navegar**
2. Clique em qualquer música
3. Selecione método de pagamento **Carteira**
4. Clique em "Adicionar à Fila — R$ 2,00"
5. Animação de sucesso → música adicionada à fila
6. O saldo da carteira diminui em R$ 2,00

### Teste 2.8 — Pagar com cartão (Stripe teste)
1. Clique em outra música
2. Selecione método de pagamento **Cartão**
3. Clique em "Adicionar à Fila — R$ 2,00"
4. Formulário de pagamento Stripe aparece
5. Digite o cartão de teste: **4242 4242 4242 4242**
6. Validade: **12/30**, CVC: **123**, CEP: **01001-000**
7. Clique em "Pagar R$ 2,00"
8. Sucesso → música adicionada à fila
9. Verifique no admin: status da transação é CONCLUÍDA

**Cartões de teste Stripe para diferentes cenários:**
- Sucesso: `4242 4242 4242 4242`
- Recusado: `4000 0000 0000 0002`
- Fundos insuficientes: `4000 0000 0000 9995`
- 3D Secure: `4000 0025 0000 3155`
- Cartão expirado: `4000 0000 0000 0069`

### Teste 2.9 — Ver fila
1. Clique na aba **Fila** na navegação inferior
2. Veja as músicas que você pagou
3. A primeira música deve aparecer como "Tocando" ou posição 1

### Teste 2.10 — Eventos Especiais
1. Clique na aba **Especial** na navegação inferior
2. Veja a grade: Fura-Fila, Silêncio, Mensagem de Texto, Mensagem de Voz, Foto, Reações, Aniversário
3. Clique em **Mensagem de Texto** → modal abre
4. Digite uma mensagem → clique em Enviar
5. Pagamento deduzido da carteira

### Teste 2.11 — Mensagem de voz (Captura de mídia)
1. Em Eventos Especiais, clique em **Mensagem de Voz**
2. Modal abre com botões "Escolher da Galeria" e "Tirar Foto"
3. Clique em "Escolher da Galeria" → selecione um arquivo de áudio do celular
4. Prévia toca → clique em "Enviar"
5. Pagamento deduzido, evento enviado ao dono do bar para aprovação

### Teste 2.12 — Página de perfil
1. Clique na aba **Perfil**
2. Veja nome, saldo, função
3. Clique em "Minha Carteira" → vai para a página da carteira
4. Clique em "Histórico de Músicas" → vai para histórico
5. Clique em "Sair" → redireciona para página inicial, usuário desconectado

---

## PARTE 3 — Fluxo do Dono do Bar

### Teste 3.1 — Login Dono do Bar
1. Entre com `carlos@bar1.com` / `password123`
2. Painel do dono carrega com abas: Máquina, Alertas, Receita, QR Code, Configurações

### Teste 3.2 — Status da máquina
1. Clique na aba **Máquina**
2. Veja "JukeBox Principal" com status ONLINE
3. Tamanho da fila mostra a quantidade atual
4. Clique em "Abrir TV Player" → TV Player abre em nova aba

### Teste 3.3 — Aprovar evento especial
1. Clique na aba **Alertas**
2. Veja eventos pendentes (mensagens de voz, fotos de clientes)
3. Clique em **Aprovar** em uma mensagem de voz
4. Status do evento muda para APROVADO

### Teste 3.4 — Receita
1. Clique na aba **Receita**
2. Veja resumo da receita apenas do seu bar
3. Veja histórico de transações

### Teste 3.5 — QR Code
1. Clique na aba **QR Code**
2. Veja o QR code do BAR-CARLOS
3. Clique em Baixar → QR baixa como PNG
4. Clique em Imprimir → diálogo de impressão

### Teste 3.6 — Configurações
1. Clique na aba **Configurações**
2. Mude o preço da música de R$ 2 para R$ 3
3. Salve → verifique que o preço mudou

---

## PARTE 4 — Fluxo do Administrador

### Teste 4.1 — Login Admin
1. Entre com `admin@jukebox.com` / `password123`
2. Painel admin carrega com menu lateral

### Teste 4.2 — Máquinas
1. Clique em **Máquinas** → veja as duas máquinas
2. Clique em uma máquina → página de detalhes

### Teste 4.3 — Bares
1. Clique em **Bares** → veja os dois bares
2. Clique em Bar do Carlos → página de detalhes com dono, divisão de comissão, chave Pix

### Teste 4.4 — Upload de música (Catálogo Musical)
1. Clique em **Catálogo Musical**
2. Clique no botão roxo **📤 Upload MP3**
3. Clique para selecionar um arquivo MP3 do computador
4. Preencha título, artista, álbum, gênero
5. Clique em Enviar Música → barra de progresso
6. Música aparece no catálogo
7. Vá para a página de navegação do cliente → nova música visível

### Teste 4.5 — Receita
1. Clique em **Receita** → veja todas as transações de todos os bares
2. Exporte CSV se necessário

### Teste 4.6 — Usuários
1. Clique em **Usuários** → veja todas as contas
2. Filtre por função

### Teste 4.7 — Produtos
1. Clique em **Produtos** → veja todos os produtos configuráveis
2. Mude o preço de um → salve

### Teste 4.8 — Configurações
1. Clique em **Configurações** → veja preços globais
2. Mude o preço padrão da música

---

## PARTE 5 — TV Player

### Teste 5.1 — Abrir TV Player
1. Em uma nova aba do navegador: **https://jukjoy.com/tv-player**
2. Entre como dono do bar
3. Selecione a máquina → TV Player carrega
4. QR code visível no canto

### Teste 5.2 — Reprodução de música
1. Se a fila tem músicas → a música toca automaticamente
2. "Tocando Agora" mostra título, artista, barra de progresso
3. Aguarde a música terminar → a próxima avança automaticamente

### Teste 5.3 — Atualização da fila em tempo real
1. Mantenha o TV Player aberto
2. No celular/outra aba, adicione uma música (pague)
3. Verifique que a música aparece na fila do TV Player imediatamente

---

## PARTE 6 — Funcionário e Afiliado

### Teste 6.1 — Login Funcionário
1. Entre com `lucas@jukebox.com` / `password123`
2. Painel do funcionário (região: São Paulo)
3. Verifique: Apenas vê bares da região de São Paulo

### Teste 6.2 — Login Afiliado
1. Entre com `rafael@promo.com` / `password123`
2. Painel do afiliado com QR code pessoal
3. Veja histórico de comissões (dados de teste)

---

## PARTE 7 — Tratamento de Erros

| # | Teste | Resultado Esperado |
|---|-------|---------------------|
| 7.1 | Código de bar inválido `FAKE-BAR` | Erro "Bar não encontrado" |
| 7.2 | Senha errada | "Credenciais inválidas" |
| 7.3 | Cliente tenta URL `/admin` | Redirecionado para página inicial |
| 7.4 | Pagar com carteira vazia | Erro ou pedir para recarregar |
| 7.5 | Gerar Pix → não pagar → aguardar 5min | Status muda para "Expirado" |

---

## PARTE 8 — Teste Rápido (5 minutos)

Se estiver com pouco tempo, faça esses 5 testes:

1. ✅ Abra https://jukjoy.com → músicas visíveis
2. ✅ Alternar idioma (EN ↔ PT)
3. ✅ Entrar como cliente → conectar ao BAR-CARLOS
4. ✅ Pagar por uma música (sandbox Pix ou cartão)
5. ✅ Abrir TV Player → música toca

---

## Lista de Resultados

| Parte | Status |
|-------|--------|
| 1. Acesso Público e Idioma | ☐ |
| 2. Jornada do Cliente | ☐ |
| 3. Fluxo do Dono do Bar | ☐ |
| 4. Fluxo do Admin | ☐ |
| 5. TV Player | ☐ |
| 6. Funcionário e Afiliado | ☐ |
| 7. Tratamento de Erros | ☐ |

---

## Observações

- **Pagamentos Pix**: Atualmente em modo sandbox no jukjoy.com. Use o botão "[SANDBOX] Simular Pagamento" em vez de pagamento real.
- **Pagamentos com cartão (Stripe)**: Configurado com chaves de teste. Use os números de cartão de teste acima — nenhum dinheiro real é cobrado.
- **Google OAuth**: Requer `VITE_GOOGLE_CLIENT_ID` em `apps/web/.env` para mostrar o botão Google Sign-In.
- **Download do YouTube**: Requer `yt-dlp` instalado no VPS e variável de ambiente `YOUTUBE_API_KEY` para melhores resultados.
- **Metadata Spotify**: Requer variáveis `SPOTIFY_CLIENT_ID` e `SPOTIFY_CLIENT_SECRET`.
