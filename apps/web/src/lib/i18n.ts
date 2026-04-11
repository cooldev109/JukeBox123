import { create } from 'zustand';

export type Language = 'en' | 'pt';

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Landing Page
    'welcome': 'Welcome to JukeBox',
    'signin_subtitle': 'Sign in to play music at any JukeBox',
    'or_use_email': 'or use email',
    'email': 'Email',
    'password': 'Password',
    'enter_jukebox': 'Enter JukeBox',
    'new_here': 'New here? Create an account',
    'or': 'or',
    'browse_without_login': 'Browse songs without login',
    'staff_login': 'Staff Login (Admin / Owner / Employee / Affiliate)',
    'your_account': 'your account',
    'name': 'Name',
    'venue_code': 'Venue Code',
    'register': 'Create Account',
    'back_to_login': 'Already have an account? Sign in',
    'login_failed': 'Login failed',
    'registration_failed': 'Registration failed',

    // Browse Page
    'login_register': 'Login / Register',
    'search_placeholder': 'Search songs, artists, albums...',
    'all': 'All',
    'no_songs_found': 'No songs found',
    'try_different': 'Try a different search or genre',
    'search_on_archive': 'Search on Internet Archive',
    'add_to_queue': 'Add to Queue',
    'vip_skip': 'VIP (Skip the Line)',
    'wallet': 'Wallet',
    'pix': 'Pix',
    'card': 'Card',
    'tap_to_preview': 'Tap to preview',
    'pause_preview': 'Pause preview',
    'payment_failed': 'Payment Failed',
    'payment_expired': 'The payment expired or was declined.',
    'try_again': 'Try Again',
    'payment_success': 'Payment Confirmed!',
    'song_added': 'Song added to queue!',
    'connect_to_bar': 'Connect to a Bar',
    'enter_venue_code': "Enter the bar's venue code to play music. You can find it on the QR code at the bar.",
    'venue_code_placeholder': 'e.g. BAR-CARLOS',
    'connect': 'Connect',
    'find_song': 'Find a song',

    // Wallet Page
    'your_balance': 'Your Balance',
    'credits_network': 'Credits work at any JukeBox in the network',
    'top_up_credits': 'Top Up Credits',
    'add_credits': 'Add Credits',
    'custom_amount': 'Custom amount',
    'add': 'Add',
    'waiting_payment': 'Waiting for payment...',
    'pix_copy_paste': 'Pix Copia e Cola:',
    'copy_pix_code': 'Copy Pix Code',
    'copied': 'Copied!',
    'sandbox_simulate': '[SANDBOX] Simulate Payment',
    'open_banking_app': 'Open your banking app, select Pix, and paste the code above. Payment confirms automatically.',
    'cancel': 'Cancel',
    'done': 'Done',
    'transaction_history': 'Transaction History',
    'no_transactions': 'No transactions yet',
    'top_up': 'Top-up',
    'song': 'Song',
    'vip_song': 'VIP Song',
    'silence': 'Silence',
    'voice_message': 'Voice Message',
    'reaction': 'Reaction',
    'photo': 'Photo',
    'birthday_pack': 'Birthday Pack',

    // Queue Page
    'now_playing': 'Now Playing',
    'up_next': 'Up Next',
    'songs_in_queue': 'songs in queue',
    'queue_empty': 'Queue is empty',
    'queue_empty_desc': 'Browse songs and add them to the queue!',
    'browse_songs': 'Browse Songs',

    // Special Events
    'special_features': 'Special Features',
    'skip_queue': 'Skip Queue',
    'text_message': 'Text Message',
    'photo_on_tv': 'Photo on TV',
    'birthday': 'Birthday',
    'reactions': 'Reactions',
    'no_machine': 'No machine connected. Please scan a venue QR code first.',

    // Profile
    'profile': 'Profile',
    'my_wallet': 'My Wallet',
    'top_up_view': 'Top up credits, view transactions',
    'song_history': 'Song History',
    'previously_played': 'Previously played songs',
    'logout': 'Logout',
    'balance': 'Balance',
    'role': 'Role',

    // Navigation
    'browse': 'Browse',
    'queue': 'Queue',
    'special': 'Special',

    // Song Request
    'request_song': 'Request a Song',
    'request_song_desc': "Can't find a song? Request it and we'll add it to the catalog.",
    'song_title': 'Song Title',
    'artist_name': 'Artist Name',
    'notes_optional': 'Notes (optional)',
    'send_request': 'Send Request',
    'request_sent': 'Request sent! We\'ll add it soon.',

    // Media Capture
    'choose_from_gallery': 'Choose from Gallery',
    'take_photo': 'Take Photo',
    'send': 'Send',
    'change': 'Change',
    'uploading': 'Uploading...',
    'start_recording': 'Start Recording',
    'stop_recording': 'Stop Recording',
    'recording': 'Recording...',
    'retake': 'Retake',

    // Admin
    'machines': 'Machines',
    'venues': 'Venues',
    'alerts': 'Alerts',
    'revenue': 'Revenue',
    'users': 'Users',
    'music_catalog': 'Music Catalog',
    'products': 'Products',
    'regions': 'Regions',
    'settings': 'Settings',

    // Common
    'loading': 'Loading...',
    'error': 'Error',
    'save': 'Save',
    'delete': 'Delete',
    'edit': 'Edit',
    'close': 'Close',
    'confirm': 'Confirm',
    'back': 'Back',
    'next': 'Next',
    'yes': 'Yes',
    'no': 'No',
  },

  pt: {
    // Landing Page
    'welcome': 'Bem-vindo ao JukeBox',
    'signin_subtitle': 'Entre para tocar música em qualquer JukeBox',
    'or_use_email': 'ou use email',
    'email': 'E-mail',
    'password': 'Senha',
    'enter_jukebox': 'Entrar no JukeBox',
    'new_here': 'Novo aqui? Crie uma conta',
    'or': 'ou',
    'browse_without_login': 'Ver músicas sem login',
    'staff_login': 'Login Staff (Admin / Dono / Funcionário / Afiliado)',
    'your_account': 'sua conta',
    'name': 'Nome',
    'venue_code': 'Código do Bar',
    'register': 'Criar Conta',
    'back_to_login': 'Já tem conta? Entrar',
    'login_failed': 'Login falhou',
    'registration_failed': 'Cadastro falhou',

    // Browse Page
    'login_register': 'Entrar / Cadastrar',
    'search_placeholder': 'Buscar músicas, artistas, álbuns...',
    'all': 'Todos',
    'no_songs_found': 'Nenhuma música encontrada',
    'try_different': 'Tente outra busca ou gênero',
    'search_on_archive': 'Buscar no Internet Archive',
    'add_to_queue': 'Adicionar à Fila',
    'vip_skip': 'VIP (Fura-Fila)',
    'wallet': 'Carteira',
    'pix': 'Pix',
    'card': 'Cartão',
    'tap_to_preview': 'Toque para ouvir',
    'pause_preview': 'Pausar',
    'payment_failed': 'Pagamento Falhou',
    'payment_expired': 'O pagamento expirou ou foi recusado.',
    'try_again': 'Tentar Novamente',
    'payment_success': 'Pagamento Confirmado!',
    'song_added': 'Música adicionada à fila!',
    'connect_to_bar': 'Conectar ao Bar',
    'enter_venue_code': 'Digite o código do bar para tocar música. Você encontra no QR code do bar.',
    'venue_code_placeholder': 'ex. BAR-CARLOS',
    'connect': 'Conectar',
    'find_song': 'Buscar música',

    // Wallet Page
    'your_balance': 'Seu Saldo',
    'credits_network': 'Créditos funcionam em qualquer JukeBox da rede',
    'top_up_credits': 'Adicionar Créditos',
    'add_credits': 'Adicionar Créditos',
    'custom_amount': 'Valor personalizado',
    'add': 'Adicionar',
    'waiting_payment': 'Aguardando pagamento...',
    'pix_copy_paste': 'Pix Copia e Cola:',
    'copy_pix_code': 'Copiar Código Pix',
    'copied': 'Copiado!',
    'sandbox_simulate': '[SANDBOX] Simular Pagamento',
    'open_banking_app': 'Abra seu app do banco, selecione Pix e cole o código acima. O pagamento é confirmado automaticamente.',
    'cancel': 'Cancelar',
    'done': 'Concluído',
    'transaction_history': 'Histórico de Transações',
    'no_transactions': 'Nenhuma transação ainda',
    'top_up': 'Recarga',
    'song': 'Música',
    'vip_song': 'Música VIP',
    'silence': 'Silêncio',
    'voice_message': 'Mensagem de Voz',
    'reaction': 'Reação',
    'photo': 'Foto',
    'birthday_pack': 'Pacote Aniversário',

    // Queue Page
    'now_playing': 'Tocando Agora',
    'up_next': 'Próximas',
    'songs_in_queue': 'músicas na fila',
    'queue_empty': 'Fila vazia',
    'queue_empty_desc': 'Navegue pelas músicas e adicione à fila!',
    'browse_songs': 'Ver Músicas',

    // Special Events
    'special_features': 'Recursos Especiais',
    'skip_queue': 'Fura-Fila',
    'text_message': 'Mensagem de Texto',
    'photo_on_tv': 'Foto na TV',
    'birthday': 'Aniversário',
    'reactions': 'Reações',
    'no_machine': 'Nenhuma máquina conectada. Escaneie o QR code do bar primeiro.',

    // Profile
    'profile': 'Perfil',
    'my_wallet': 'Minha Carteira',
    'top_up_view': 'Adicionar créditos, ver transações',
    'song_history': 'Histórico de Músicas',
    'previously_played': 'Músicas tocadas anteriormente',
    'logout': 'Sair',
    'balance': 'Saldo',
    'role': 'Função',

    // Navigation
    'browse': 'Buscar',
    'queue': 'Fila',
    'special': 'Especial',

    // Song Request
    'request_song': 'Pedir uma Música',
    'request_song_desc': 'Não encontrou uma música? Peça e nós adicionamos ao catálogo.',
    'song_title': 'Nome da Música',
    'artist_name': 'Nome do Artista',
    'notes_optional': 'Observações (opcional)',
    'send_request': 'Enviar Pedido',
    'request_sent': 'Pedido enviado! Vamos adicionar em breve.',

    // Media Capture
    'choose_from_gallery': 'Escolher da Galeria',
    'take_photo': 'Tirar Foto',
    'send': 'Enviar',
    'change': 'Trocar',
    'uploading': 'Enviando...',
    'start_recording': 'Iniciar Gravação',
    'stop_recording': 'Parar Gravação',
    'recording': 'Gravando...',
    'retake': 'Refazer',

    // Admin
    'machines': 'Máquinas',
    'venues': 'Bares',
    'alerts': 'Alertas',
    'revenue': 'Receita',
    'users': 'Usuários',
    'music_catalog': 'Catálogo de Músicas',
    'products': 'Produtos',
    'regions': 'Regiões',
    'settings': 'Configurações',

    // Common
    'loading': 'Carregando...',
    'error': 'Erro',
    'save': 'Salvar',
    'delete': 'Excluir',
    'edit': 'Editar',
    'close': 'Fechar',
    'confirm': 'Confirmar',
    'back': 'Voltar',
    'next': 'Próximo',
    'yes': 'Sim',
    'no': 'Não',
  },
};

export const useI18n = create<I18nState>((set, get) => ({
  language: (localStorage.getItem('jb_language') as Language) || 'en',

  setLanguage: (lang: Language) => {
    localStorage.setItem('jb_language', lang);
    set({ language: lang });
  },

  t: (key: string) => {
    const { language } = get();
    return translations[language][key] || translations.en[key] || key;
  },
}));
