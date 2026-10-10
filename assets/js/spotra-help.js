/* SPOTRA · Ayuda de SPOTRI (v1)
   - Botón flotante con la cara de SPOTRI en todas las pantallas (no en login/registro ni durante la guía).
     Se acomoda solo arriba del + , del botón de ubicación del mapa y de la barra inferior.
   - Burbuja "¿Necesitas ayuda?" solo la primera vez.
   - Panel: desde abajo en celular; a la derecha (420 px) en tablet y computadora.
     Buscador, temas, preguntas con respuesta, botón que lleva al lugar exacto y "¿Te sirvió? Sí/No" (no se guarda).
   - Respuestas armadas (sin IA) en español, português e english.
   - Contacto SOLO por mail o Instagram. Nunca el WhatsApp de SPOTRA. */
(function(){
  if(window.SpotraHelp) return;

  const FACE = 'assets/Spotri/spotri-cara.webp';
  const MAIL = 'spotra.2026@gmail.com';
  const TIP_KEY = 'spotra_help_tip';

  /* ---------- textos de la interfaz ---------- */
  const UI = {
    es: { fab: 'Ayuda de SPOTRI', tip: '¿Necesitas ayuda?', title: 'Ayuda de SPOTRI', sub: '¿En qué te ayudo?', search: 'Busca tu duda…', topics: 'Temas', back: 'Temas', results: 'Resultados', none: 'No encontré nada con eso. Prueba con otra palabra o escríbenos por mail.', useful: '¿Te sirvió?', yes: 'Sí', no: 'No', thanksYes: '¡Genial! Gracias por avisar.', thanksNo: 'Gracias. Si sigues con la duda, escríbenos por mail.', mail: 'Escribir por mail', guide: 'Ver la guía otra vez', close: 'Cerrar', q: 'preguntas' },
    pt: { fab: 'Ajuda do SPOTRI', tip: 'Precisa de ajuda?', title: 'Ajuda do SPOTRI', sub: 'Como posso ajudar?', search: 'Busque sua dúvida…', topics: 'Temas', back: 'Temas', results: 'Resultados', none: 'Não achei nada com isso. Tente outra palavra ou mande um e-mail.', useful: 'Ajudou?', yes: 'Sim', no: 'Não', thanksYes: 'Show! Obrigado por avisar.', thanksNo: 'Obrigado. Se a dúvida continuar, mande um e-mail.', mail: 'Enviar e-mail', guide: 'Ver o guia de novo', close: 'Fechar', q: 'perguntas' },
    en: { fab: 'SPOTRI help', tip: 'Need help?', title: 'SPOTRI help', sub: 'How can I help?', search: 'Search your question…', topics: 'Topics', back: 'Topics', results: 'Results', none: 'Nothing found. Try another word or email us.', useful: 'Was this helpful?', yes: 'Yes', no: 'No', thanksYes: 'Great! Thanks for letting us know.', thanksNo: 'Thanks. If you still need help, email us.', mail: 'Email us', guide: 'See the guide again', close: 'Close', q: 'questions' }
  };

  /* ---------- temas ---------- */
  const TOPICS = [
    { id: 'map', ic: 'pin', es: 'Mapa y spots', pt: 'Mapa e spots', en: 'Map and spots' },
    { id: 'ses', ic: 'clock', es: 'Sesiones', pt: 'Sessões', en: 'Sessions' },
    { id: 'ev', ic: 'cal', es: 'Eventos', pt: 'Eventos', en: 'Events' },
    { id: 'mk', ic: 'bag', es: 'Market', pt: 'Market', en: 'Market' },
    { id: 'forum', ic: 'chat', es: 'Foro', pt: 'Fórum', en: 'Forum' },
    { id: 'al', ic: 'bell', es: 'Avisos', pt: 'Avisos', en: 'Alerts' },
    { id: 'acc', ic: 'user', es: 'Mi cuenta', pt: 'Minha conta', en: 'My account' }
  ];

  /* ---------- preguntas: [pregunta, respuesta, botón] por idioma + acción ---------- */
  const FAQ = [
    { t: 'map', act: 'locate',
      es: ['¿Cómo encuentro spots cerca?', 'Abre el mapa y activa tu ubicación con el botón de ubicación. Abajo ves los lugares de la zona, del más cercano al más lejano.', 'Ubicarme en el mapa'],
      pt: ['Como encontro spots perto de mim?', 'Abra o mapa e ative sua localização no botão de localização. Embaixo aparecem os lugares da região, do mais perto ao mais longe.', 'Me localizar no mapa'],
      en: ['How do I find spots nearby?', 'Open the map and turn on your location with the location button. Below you’ll see places in the area, closest first.', 'Locate me on the map'] },
    { t: 'map', act: 'spot',
      es: ['¿Cómo agrego un spot o skatepark?', 'Toca <b>+</b> › <b>Spot o skatepark</b>, sube una foto y marca el lugar con <b>Usar mi ubicación</b> o buscando la dirección. Queda pendiente de aprobación y te avisamos cuando aparece en el mapa.', 'Agregar spot'],
      pt: ['Como adiciono um spot ou pista?', 'Toque em <b>+</b> › <b>Spot ou pista</b>, envie uma foto e marque o lugar com <b>Usar minha localização</b> ou buscando o endereço. Ele fica pendente de aprovação e avisamos quando aparecer no mapa.', 'Adicionar spot'],
      en: ['How do I add a spot or skatepark?', 'Tap <b>+</b> › <b>Spot or skatepark</b>, upload a photo and mark the place with <b>Use my location</b> or by searching the address. It stays pending approval and we’ll let you know when it shows on the map.', 'Add a spot'] },
    { t: 'map', act: 'map',
      es: ['¿Qué es el estado del spot?', 'En la ficha del spot toca <b>Avisar estado</b> (seco y rodable, lloviendo, lleno de gente…). Lo ven todos y vence solo en unas horas. También ves el clima de las próximas horas.', 'Ir al mapa'],
      pt: ['O que é o status do spot?', 'Na ficha do spot toque em <b>Avisar estado</b> (seco e andável, chovendo, lotado…). Todos veem e expira sozinho em algumas horas. Você também vê o clima das próximas horas.', 'Ir para o mapa'],
      en: ['What is the spot status?', 'On the spot card tap <b>Report conditions</b> (dry and rideable, raining, crowded…). Everyone sees it and it expires on its own in a few hours. You also see the weather for the next hours.', 'Go to the map'] },
    { t: 'map', act: 'map',
      es: ['¿Cómo llego a un spot o lo comparto?', 'En la ficha del spot tienes <b>Cómo llegar</b> y <b>Compartir</b> (WhatsApp, Instagram o copiar el link).', 'Ir al mapa'],
      pt: ['Como chego a um spot ou compartilho?', 'Na ficha do spot você tem <b>Como chegar</b> e <b>Compartilhar</b> (WhatsApp, Instagram ou copiar o link).', 'Ir para o mapa'],
      en: ['How do I get to a spot or share it?', 'On the spot card you have <b>Directions</b> and <b>Share</b> (WhatsApp, Instagram or copy the link).', 'Go to the map'] },

    { t: 'ses', act: 'map',
      es: ['¿Qué es una sesión?', 'Es un plan para rodar: spot, día y horario. Se publica al instante, se ve en el mapa hasta que termina y otros riders se pueden sumar.', 'Ver sesiones en el mapa'],
      pt: ['O que é uma sessão?', 'É um plano pra andar: spot, dia e horário. Publica na hora, aparece no mapa até terminar e outros riders podem ir junto.', 'Ver sessões no mapa'],
      en: ['What is a session?', 'It’s a plan to ride: spot, day and time. It’s posted instantly, shows on the map until it ends, and other riders can join.', 'See sessions on the map'] },
    { t: 'ses', act: 'session',
      es: ['¿Cómo creo una sesión?', 'Toca un spot en el mapa y luego <b>Crear sesión acá</b>, o usa <b>+</b> › <b>Crear sesión</b>. Puede ser hasta 7 días adelante y durar hasta 8 horas.', 'Crear sesión'],
      pt: ['Como crio uma sessão?', 'Toque em um spot no mapa e depois em <b>Criar sessão aqui</b>, ou use <b>+</b> › <b>Criar sessão</b>. Pode ser até 7 dias à frente e durar até 8 horas.', 'Criar sessão'],
      en: ['How do I create a session?', 'Tap a spot on the map and then <b>Create session here</b>, or use <b>+</b> › <b>Create session</b>. It can be up to 7 days ahead and last up to 8 hours.', 'Create a session'] },
    { t: 'ses', act: 'map',
      es: ['¿Cómo me sumo o me bajo de una sesión?', 'Abre la sesión en el mapa y súmate desde ahí. Si cambias de planes, te bajas en el mismo lugar. Si la creaste tú, puedes terminarla y deja de verse.', 'Ir al mapa'],
      pt: ['Como entro ou saio de uma sessão?', 'Abra a sessão no mapa e entre por lá. Se mudar de planos, sai no mesmo lugar. Se foi você que criou, pode encerrar e ela some do mapa.', 'Ir para o mapa'],
      en: ['How do I join or leave a session?', 'Open the session on the map and join from there. If your plans change, you leave from the same place. If you created it, you can end it and it disappears.', 'Go to the map'] },
    { t: 'ses', act: 'alerts',
      es: ['¿Quién se entera de mi sesión?', 'Tus seguidores y los riders cerca que activaron los avisos de sesiones.', 'Avisos de sesiones'],
      pt: ['Quem fica sabendo da minha sessão?', 'Seus seguidores e os riders por perto que ativaram os avisos de sessões.', 'Avisos de sessões'],
      en: ['Who finds out about my session?', 'Your followers and nearby riders who turned on session alerts.', 'Session alerts'] },

    { t: 'ev', act: 'events',
      es: ['¿Cómo me inscribo a un evento?', 'Entra a <b>Eventos</b>, abre el evento y toca <b>Inscribirme</b>. También puedes marcar <b>Me interesa</b> o agregarlo a tu calendario.', 'Ver eventos'],
      pt: ['Como me inscrevo em um evento?', 'Entre em <b>Eventos</b>, abra o evento e toque em <b>Me inscrever</b>. Você também pode marcar que tem interesse ou adicionar à sua agenda.', 'Ver eventos'],
      en: ['How do I sign up for an event?', 'Go to <b>Events</b>, open the event and tap <b>Register</b>. You can also mark that you’re interested or add it to your calendar.', 'See events'] },
    { t: 'ev', act: 'event',
      es: ['¿Puedo organizar un evento?', 'Sí: <b>+</b> › <b>Competencia o evento</b>, elige un spot del mapa y completa los datos. Queda pendiente de aprobación antes de publicarse.', 'Crear evento'],
      pt: ['Posso organizar um evento?', 'Sim: <b>+</b> › <b>Competição ou evento</b>, escolha um spot do mapa e preencha os dados. Fica pendente de aprovação antes de ser publicado.', 'Criar evento'],
      en: ['Can I organize an event?', 'Yes: <b>+</b> › <b>Contest or event</b>, pick a spot on the map and fill in the details. It stays pending approval before it’s published.', 'Create an event'] },
    { t: 'ev', act: 'events',
      es: ['¿Cómo funciona el ranking?', 'El organizador carga el podio de cada categoría y suma puntos: 1º 100, 2º 60 y 3º 30. El ranking es por disciplina.', 'Ver eventos'],
      pt: ['Como funciona o ranking?', 'O organizador registra o pódio de cada categoria e soma pontos: 1º 100, 2º 60 e 3º 30. O ranking é por modalidade.', 'Ver eventos'],
      en: ['How does the ranking work?', 'The organizer enters the podium for each category and adds points: 1st 100, 2nd 60 and 3rd 30. The ranking is by discipline.', 'See events'] },

    { t: 'mk', act: 'product',
      es: ['¿Cómo vendo algo?', '<b>+</b> › <b>Producto usado</b>: hasta 6 fotos, precio, estado, ciudad y tu WhatsApp. Pasa por aprobación antes de publicarse.', 'Publicar producto'],
      pt: ['Como vendo algo?', '<b>+</b> › <b>Produto usado</b>: até 6 fotos, preço, estado, cidade e seu WhatsApp. Passa por aprovação antes de ser publicado.', 'Publicar produto'],
      en: ['How do I sell something?', '<b>+</b> › <b>Used product</b>: up to 6 photos, price, condition, city and your WhatsApp. It’s reviewed before it’s published.', 'Post a product'] },
    { t: 'mk', act: 'market',
      es: ['¿Cómo se paga?', 'SPOTRA no cobra ni maneja pagos: comprador y vendedor arreglan todo por WhatsApp. Antes de pagar, revisa el producto en persona.', 'Ir al Market'],
      pt: ['Como é o pagamento?', 'O SPOTRA não cobra nem recebe pagamentos: comprador e vendedor combinam tudo pelo WhatsApp. Antes de pagar, confira o produto pessoalmente.', 'Ir para o Market'],
      en: ['How do payments work?', 'SPOTRA doesn’t charge or handle payments: buyer and seller arrange everything on WhatsApp. Before paying, check the product in person.', 'Go to the Market'] },
    { t: 'mk', act: 'mine',
      es: ['¿Cómo marco algo como vendido o bajo el precio?', 'En el Market entra a <b>Tú</b> › <b>Tus publicaciones</b>, elige el producto y toca <b>Bajar precio o marcar vendido</b>.', 'Mis publicaciones'],
      pt: ['Como marco como vendido ou baixo o preço?', 'No Market entre na sua área › suas publicações, escolha o produto e use a opção de baixar preço ou marcar como vendido.', 'Minhas publicações'],
      en: ['How do I mark something as sold or lower the price?', 'In the Market go to your area › your listings, pick the product and use the option to lower the price or mark it as sold.', 'My listings'] },
    { t: 'mk', act: 'saved',
      es: ['¿Puedo guardar productos?', 'Sí, con <b>Guardar</b> en el producto. Los encuentras en <b>Guardados</b> y puedes ordenarlos en colecciones.', 'Mis guardados'],
      pt: ['Posso salvar produtos?', 'Sim, com <b>Salvar</b> no produto. Eles ficam nos salvos e você pode organizar em coleções.', 'Meus salvos'],
      en: ['Can I save products?', 'Yes, with <b>Save</b> on the product. You’ll find them in your saved items and can sort them into collections.', 'My saved items'] },

    { t: 'forum', act: 'post',
      es: ['¿Cómo publico en el foro?', 'Toca <b>+</b> › <b>Publicación del foro</b>. Puedes sumar una foto y se publica al instante.', 'Crear publicación'],
      pt: ['Como posto no fórum?', 'Toque em <b>+</b> › <b>Post no fórum</b>. Você pode adicionar uma foto e publica na hora.', 'Criar post'],
      en: ['How do I post on the forum?', 'Tap <b>+</b> › <b>Forum post</b>. You can add a photo and it’s posted instantly.', 'Create a post'] },
    { t: 'forum', act: 'forum',
      es: ['¿Cómo borro una publicación o comentario mío?', 'En el foro, busca tu publicación o tu comentario y toca <b>Eliminar</b>. No se puede deshacer.', 'Ir al foro'],
      pt: ['Como apago um post ou comentário meu?', 'No fórum, encontre seu post ou comentário e toque em <b>Excluir</b>. Não dá pra desfazer.', 'Ir para o fórum'],
      en: ['How do I delete my post or comment?', 'In the forum, find your post or comment and tap <b>Delete</b>. It can’t be undone.', 'Go to the forum'] },

    { t: 'al', act: 'push',
      es: ['¿Cómo activo los avisos?', '<b>Perfil</b> › <b>Configuración</b> › <b>Activar notificaciones</b>. En iPhone solo funcionan con SPOTRA instalada en la pantalla de inicio (Compartir › Agregar a inicio).', 'Activar avisos'],
      pt: ['Como ativo os avisos?', '<b>Perfil</b> › <b>Configurações</b> › <b>Ativar notificações</b>. No iPhone só funcionam com o SPOTRA instalado na tela de início (Compartilhar › Adicionar à Tela de Início).', 'Ativar avisos'],
      en: ['How do I turn on alerts?', '<b>Profile</b> › <b>Settings</b> › <b>Turn on notifications</b>. On iPhone they only work with SPOTRA installed on your home screen (Share › Add to Home Screen).', 'Turn on alerts'] },
    { t: 'al', act: 'settings',
      es: ['No me llegan los avisos, ¿qué hago?', 'Revisa que estén permitidos en los ajustes del celular para SPOTRA. Si reinstalaste la app, vuelve a activarlos en Configuración.', 'Ir a Configuración'],
      pt: ['Os avisos não chegam, o que faço?', 'Confira se estão permitidos nos ajustes do celular para o SPOTRA. Se reinstalou o app, ative de novo em Configurações.', 'Ir para Configurações'],
      en: ['I’m not getting alerts, what do I do?', 'Check that they’re allowed in your phone settings for SPOTRA. If you reinstalled the app, turn them on again in Settings.', 'Go to Settings'] },
    { t: 'al', act: 'alerts',
      es: ['¿Cómo elijo de qué zona me avisan las sesiones?', 'En <b>Configuración</b> › <b>Avisos de sesiones</b> marca tu zona y la distancia. Nunca guardamos tu ubicación exacta, solo la zona (~1 km).', 'Avisos de sesiones'],
      pt: ['Como escolho de qual região recebo avisos de sessões?', 'Em <b>Configurações</b> › <b>Avisos de sessões</b> marque sua região e a distância. Nunca guardamos sua localização exata, só a região (~1 km).', 'Avisos de sessões'],
      en: ['How do I choose the area for session alerts?', 'In <b>Settings</b> › <b>Session alerts</b> set your area and distance. We never store your exact location, only the area (~1 km).', 'Session alerts'] },

    { t: 'acc', act: 'editProfile',
      es: ['¿Cómo edito mi perfil?', '<b>Perfil</b> › <b>Configuración</b> › <b>Editar perfil y redes sociales</b>.', 'Editar perfil'],
      pt: ['Como edito meu perfil?', '<b>Perfil</b> › <b>Configurações</b> › editar perfil e redes sociais.', 'Editar perfil'],
      en: ['How do I edit my profile?', '<b>Profile</b> › <b>Settings</b> › edit profile and social links.', 'Edit profile'] },
    { t: 'acc', act: 'password',
      es: ['¿Cómo cambio mi contraseña?', '<b>Perfil</b> › <b>Configuración</b> › <b>Cambiar contraseña</b>. Si no la recuerdas, cierra sesión y en el inicio toca <b>¿Olvidaste tu contraseña?</b>', 'Cambiar contraseña'],
      pt: ['Como altero minha senha?', '<b>Perfil</b> › <b>Configurações</b> › <b>Alterar senha</b>. Se não lembra, saia da conta e na tela de entrada toque em <b>Esqueceu sua senha?</b>', 'Alterar senha'],
      en: ['How do I change my password?', '<b>Profile</b> › <b>Settings</b> › <b>Change password</b>. If you don’t remember it, log out and on the login screen tap <b>Forgot your password?</b>', 'Change password'] },
    { t: 'acc', act: 'blocked',
      es: ['¿Cómo reporto o bloqueo a alguien?', 'Toca <b>Reportar</b> en su perfil, publicación, comentario, producto o sesión. Ahí mismo puedes bloquearlo. El admin revisa los reportes y nadie sabe quién reportó; los bloqueados no se enteran.', 'Usuarios bloqueados'],
      pt: ['Como denuncio ou bloqueio alguém?', 'Toque em <b>Denunciar</b> no perfil, post, comentário, produto ou sessão da pessoa. Ali mesmo você pode bloquear. O admin revisa as denúncias e ninguém sabe quem denunciou; quem é bloqueado não fica sabendo.', 'Usuários bloqueados'],
      en: ['How do I report or block someone?', 'Tap <b>Report</b> on their profile, post, comment, product or session. You can block them right there. The admin reviews reports and no one knows who reported; blocked users aren’t notified.', 'Blocked users'] },
    { t: 'acc', act: 'guardian',
      es: ['Soy menor de 18, ¿qué puedo hacer?', 'Desde los 13 años puedes usar SPOTRA. Para crear sesiones (solo en skateparks), publicar en el Market y recibir avisos, un adulto responsable tiene que vincular tu cuenta con un código que vence en 48 horas.', 'Responsable / menores'],
      pt: ['Tenho menos de 18, o que posso fazer?', 'A partir dos 13 anos você pode usar o SPOTRA. Para criar sessões (só em pistas), publicar no Market e receber avisos, um adulto responsável precisa vincular sua conta com um código que vence em 48 horas.', 'Responsável / menores'],
      en: ['I’m under 18, what can I do?', 'From age 13 you can use SPOTRA. To create sessions (skateparks only), post on the Market and get alerts, a responsible adult has to link your account with a code that expires in 48 hours.', 'Guardian / minors'] },
    { t: 'acc', act: 'presence',
      es: ['¿Quién ve dónde estoy?', 'Nadie, salvo que actives <b>Mostrar cuando estoy andando en un spot</b> en Configuración, y solo mientras la app está abierta. Nunca mostramos la ubicación exacta de menores.', 'Ir a Configuración'],
      pt: ['Quem vê onde eu estou?', 'Ninguém, a menos que você ative a opção de mostrar quando está andando em um spot, em Configurações, e só enquanto o app está aberto. Nunca mostramos a localização exata de menores.', 'Ir para Configurações'],
      en: ['Who can see where I am?', 'No one, unless you turn on the option to show when you’re riding at a spot in Settings, and only while the app is open. We never show the exact location of minors.', 'Go to Settings'] },
    { t: 'acc', act: 'deleteAccount',
      es: ['¿Cómo elimino mi cuenta?', '<b>Perfil</b> › <b>Configuración</b> › <b>Eliminar mi cuenta</b>. Es definitivo.', 'Eliminar mi cuenta'],
      pt: ['Como excluo minha conta?', '<b>Perfil</b> › <b>Configurações</b> › <b>Excluir minha conta</b>. É definitivo.', 'Excluir minha conta'],
      en: ['How do I delete my account?', '<b>Profile</b> › <b>Settings</b> › <b>Delete my account</b>. It’s permanent.', 'Delete my account'] },
    { t: 'acc', act: 'mail',
      es: ['¿Cómo contacto a SPOTRA?', 'Escríbenos a <b>' + MAIL + '</b> o por Instagram <b>@spotra.ok</b>.', 'Escribir por mail'],
      pt: ['Como falo com o SPOTRA?', 'Mande um e-mail para <b>' + MAIL + '</b> ou fale no Instagram <b>@spotra.ok</b>.', 'Enviar e-mail'],
      en: ['How do I contact SPOTRA?', 'Email us at <b>' + MAIL + '</b> or reach us on Instagram <b>@spotra.ok</b>.', 'Email us'] }
  ];
  FAQ.forEach((f, i) => { f.id = 'q' + i; });

  function lang(){
    const l = window.SpotraI18n && window.SpotraI18n.lang ? window.SpotraI18n.lang() : 'es';
    return UI[l] ? l : 'es';
  }
  const U = () => UI[lang()];
  const norm = s => String(s || '').replace(/<[^>]+>/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /* ---------- íconos ---------- */
  const IC = {
    pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cal: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    chat: '<path d="M4 5h16v11H9l-4 4V5Z"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    guide: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.9"/><circle cx="12" cy="17.2" r=".6" fill="currentColor"/>'
  };
  const svg = (k, cls) => `<svg ${cls ? `class="${cls}" ` : ''}aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;

  /* ---------- estilos ---------- */
  const CSS = `
#spotriHelpFab{position:fixed;right:22px;bottom:96px;z-index:75;width:52px;height:52px;border-radius:50%;padding:0;border:2px solid #74ff3a;background:#101612;box-shadow:0 8px 24px rgba(0,0,0,.45),0 0 18px rgba(116,255,58,.25);cursor:pointer;display:none;overflow:hidden;-webkit-tap-highlight-color:transparent;transition:transform .15s}
#spotriHelpFab.show{display:block}
#spotriHelpFab:active{transform:scale(.94)}
#spotriHelpFab:focus-visible{outline:2px solid #f5f7f4;outline-offset:3px}
#spotriHelpFab img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
#spotriHelpTip{position:fixed;z-index:76;display:none;background:#f5f7f4;color:#070907;font:600 14px var(--body,'General Sans',sans-serif);padding:10px 14px;border-radius:16px 16px 4px 16px;box-shadow:0 8px 24px rgba(0,0,0,.35);white-space:nowrap;cursor:pointer;animation:shTip .3s ease both}
#spotriHelpTip.show{display:block}
@keyframes shTip{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
#spotriHelp{position:fixed;inset:0;z-index:8800;display:none;font-family:var(--body,'General Sans',sans-serif);-webkit-text-size-adjust:100%}
#spotriHelp.open{display:block}
#spotriHelp *{box-sizing:border-box}
.sh-back{position:absolute;inset:0;background:rgba(0,0,0,.6);animation:shFade .2s ease both}
@keyframes shFade{from{opacity:0}to{opacity:1}}
.sh-panel{position:absolute;left:0;right:0;bottom:0;max-height:88vh;max-height:88dvh;height:88vh;height:88dvh;display:flex;flex-direction:column;background:#070907;color:#f5f7f4;border-radius:24px 24px 0 0;border:1px solid rgba(116,255,58,.25);border-bottom:0;box-shadow:0 -20px 60px rgba(0,0,0,.5);animation:shUp .28s ease both;outline:none}
@keyframes shUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
.sh-grab{width:42px;height:5px;border-radius:3px;background:#2a332b;margin:8px auto 0;flex-shrink:0}
.sh-head{display:flex;align-items:center;gap:12px;padding:10px 16px 12px 18px;flex-shrink:0}
.sh-face{width:44px;height:44px;border-radius:50%;border:2px solid #74ff3a;background:#101612;overflow:hidden;flex-shrink:0}
.sh-face img{width:100%;height:100%;object-fit:cover;display:block}
.sh-head h2{margin:0;font:600 20px/1.1 var(--display,'Clash Display',sans-serif);letter-spacing:.01em;color:#f5f7f4}
.sh-head p{margin:2px 0 0;font:500 13px var(--body,'General Sans',sans-serif);color:#9aa39a}
.sh-x{margin-left:auto;width:44px;height:44px;border-radius:14px;border:1px solid #2a332b;background:transparent;color:#f5f7f4;display:grid;place-items:center;cursor:pointer;flex-shrink:0}
.sh-x svg{width:18px;height:18px}
.sh-search{margin:0 16px 10px;display:flex;align-items:center;gap:10px;height:48px;padding:0 14px;border-radius:14px;background:#101612;border:1px solid #1f2720;flex-shrink:0}
.sh-search:focus-within{border-color:rgba(116,255,58,.55)}
.sh-search svg{width:18px;height:18px;color:#9aa39a;flex-shrink:0}
.sh-search input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:#f5f7f4;font:500 16px var(--body,'General Sans',sans-serif);-webkit-appearance:none;appearance:none}
.sh-search input::placeholder{color:#7d867d}
.sh-search input::-webkit-search-cancel-button{-webkit-appearance:none}
.sh-body{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:4px 16px 16px}
.sh-label{margin:10px 2px 10px;font:600 12px var(--body,'General Sans',sans-serif);letter-spacing:.16em;text-transform:uppercase;color:#74ff3a}
.sh-topics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.sh-topic{display:flex;flex-direction:column;align-items:flex-start;gap:8px;min-height:88px;padding:14px;border-radius:16px;background:#101612;border:1px solid #1f2720;color:#f5f7f4;text-align:left;cursor:pointer}
.sh-topic:hover{border-color:rgba(116,255,58,.4)}
.sh-topic svg{width:22px;height:22px;color:#74ff3a}
.sh-topic b{font:600 15px var(--display,'Clash Display',sans-serif);letter-spacing:.01em}
.sh-topic small{font:500 12px var(--body,'General Sans',sans-serif);color:#9aa39a}
.sh-backbtn{display:inline-flex;align-items:center;gap:4px;min-height:40px;padding:0 10px 0 4px;margin:2px 0 4px;border:0;background:transparent;color:#9aa39a;font:600 14px var(--body,'General Sans',sans-serif);cursor:pointer}
.sh-backbtn svg{width:18px;height:18px}
.sh-ttl{margin:0 2px 10px;font:600 24px/1.05 var(--display,'Clash Display',sans-serif);text-transform:uppercase;color:#f5f7f4}
.sh-list{display:flex;flex-direction:column;gap:8px}
.sh-item{border-radius:16px;background:#101612;border:1px solid #1f2720;overflow:hidden}
.sh-item.open{border-color:rgba(116,255,58,.35)}
.sh-q{width:100%;display:flex;align-items:center;gap:10px;min-height:56px;padding:12px 14px;border:0;background:transparent;color:#f5f7f4;text-align:left;font:600 15px/1.3 var(--body,'General Sans',sans-serif);cursor:pointer}
.sh-q span{flex:1}
.sh-q svg{width:18px;height:18px;color:#9aa39a;flex-shrink:0;transition:transform .2s}
.sh-item.open .sh-q svg{transform:rotate(180deg);color:#74ff3a}
.sh-a{display:none;padding:0 14px 14px}
.sh-item.open .sh-a{display:block}
.sh-a p{margin:0;font:500 15px/1.5 var(--body,'General Sans',sans-serif);color:#c9d1c8}
.sh-a p b{color:#f5f7f4;font-weight:600}
.sh-go{margin-top:12px;width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:12px;background:#74ff3a;color:#051006;font:600 15px var(--body,'General Sans',sans-serif);cursor:pointer}
.sh-go svg{width:18px;height:18px}
.sh-fb{display:flex;align-items:center;gap:8px;margin-top:12px;font:500 13px var(--body,'General Sans',sans-serif);color:#9aa39a;flex-wrap:wrap}
.sh-fb button{min-height:36px;min-width:52px;padding:0 12px;border-radius:10px;border:1px solid #2a332b;background:transparent;color:#f5f7f4;font:600 13px var(--body,'General Sans',sans-serif);cursor:pointer}
.sh-fb button:hover{border-color:#74ff3a}
.sh-fb .ok{color:#74ff3a}
.sh-none{padding:22px 6px;font:500 15px/1.5 var(--body,'General Sans',sans-serif);color:#c9d1c8;text-align:center}
.sh-foot{display:flex;gap:8px;flex-shrink:0;padding:10px 16px max(16px,env(safe-area-inset-bottom));border-top:1px solid #1a201b;background:#070907}
.sh-foot a,.sh-foot button{flex:1;min-height:48px;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 10px;border-radius:12px;border:1px solid #2a332b;background:transparent;color:#f5f7f4;font:600 14px var(--body,'General Sans',sans-serif);text-decoration:none;cursor:pointer;text-align:center}
.sh-foot svg{width:18px;height:18px;color:#74ff3a;flex-shrink:0}
#spotriHelp button:focus-visible,#spotriHelp a:focus-visible{outline:2px solid #74ff3a;outline-offset:2px}
body.spotri-help-open{overflow:hidden}
@keyframes shFlash{0%,100%{box-shadow:none}30%,70%{box-shadow:0 0 0 3px #74ff3a}}
.sh-flash{animation:shFlash 1.6s ease 2;border-radius:14px}
@media (min-width:768px){
  .sh-panel{left:auto;top:0;right:0;bottom:0;width:420px;height:100%;max-height:none;border-radius:24px 0 0 24px;border:1px solid rgba(116,255,58,.25);border-right:0;animation:shSide .28s ease both}
  @keyframes shSide{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}
  .sh-grab{display:none}
  .sh-head{padding-top:18px}
}
@media (prefers-reduced-motion:reduce){.sh-panel,.sh-back,#spotriHelpTip{animation:none}}
`;

  /* ---------- acciones (a dónde lleva cada botón) ---------- */
  function route(r){ try { if(typeof window.setRoute === 'function') window.setRoute(r); } catch(e){} }
  function fire(selector, attr, value){
    // usa el botón real de la app; si no está dibujado, crea uno temporal con el mismo atributo
    let el = document.querySelector(selector);
    let temp = false;
    if(!el){ el = document.createElement('button'); el.type = 'button'; el.setAttribute(attr, value || ''); el.style.display = 'none'; document.body.appendChild(el); temp = true; }
    el.click();
    if(temp) setTimeout(() => el.remove(), 0);
  }
  function waitFor(selector, fn, tries){
    const el = document.querySelector(selector);
    if(el && el.offsetParent !== null){ fn(el); return; }
    if((tries || 0) > 25) { if(el) fn(el); return; }
    setTimeout(() => waitFor(selector, fn, (tries || 0) + 1), 150);
  }
  function openSettings(then){
    fire('[data-open-modal="settings"]', 'data-open-modal', 'settings');
    if(then) setTimeout(then, 300);
  }
  function flash(selector){
    const el = document.querySelector(selector);
    if(!el) return;
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e){ el.scrollIntoView(); }
    el.classList.remove('sh-flash'); void el.offsetWidth; el.classList.add('sh-flash');
    setTimeout(() => el.classList.remove('sh-flash'), 3400);
  }
  const ACT = {
    locate: () => { route('map'); waitFor('#mapLocateBtn', b => b.click()); },
    map: () => route('map'),
    spot: () => fire('[data-open-modal="spot"]', 'data-open-modal', 'spot'),
    session: () => fire('[data-ses-menu]', 'data-ses-menu'),
    events: () => route('events'),
    event: () => fire('[data-open-modal="event"]', 'data-open-modal', 'event'),
    product: () => fire('[data-open-modal="product"]', 'data-open-modal', 'product'),
    market: () => route('market'),
    mine: () => { route('market'); setTimeout(() => fire('[data-mk-tab="mine"]', 'data-mk-tab', 'mine'), 350); },
    saved: () => { route('market'); setTimeout(() => fire('[data-mk-tab="saved"]', 'data-mk-tab', 'saved'), 350); },
    forum: () => route('community'),
    post: () => fire('[data-open-modal="post"]', 'data-open-modal', 'post'),
    push: () => openSettings(() => { const box = document.getElementById('pushBox'); flash(box && box.style.display !== 'none' ? '#pushBox' : '#pushHint'); }),
    settings: () => openSettings(),
    alerts: () => fire('[data-open-alerts]', 'data-open-alerts'),
    editProfile: () => fire('[data-open-modal="editProfile"]', 'data-open-modal', 'editProfile'),
    password: () => fire('[data-open-modal="password"]', 'data-open-modal', 'password'),
    blocked: () => fire('[data-open-modal="blocked"]', 'data-open-modal', 'blocked'),
    guardian: () => fire('[data-open-guardian]', 'data-open-guardian'),
    presence: () => openSettings(() => { const i = document.getElementById('presenceOn'); const l = i && i.closest('label'); if(l){ l.id = l.id || 'shPresenceRow'; flash('#' + l.id); } }),
    deleteAccount: () => fire('[data-open-modal="deleteAccount"]', 'data-open-modal', 'deleteAccount'),
    mail: () => { location.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent('Ayuda SPOTRA'); },
    guide: () => { if(window.SpotraGuide && window.SpotraGuide.open) window.SpotraGuide.open(); }
  };

  /* ---------- estado ---------- */
  const st = { open: false, view: 'home', topic: null, query: '', openItem: null, fb: {} };
  let fab = null, tip = null, root = null, lastFocus = null;

  function ensureDom(){
    if(root) return;
    const s = document.createElement('style');
    s.id = 'spotriHelpCss';
    s.textContent = CSS;
    document.head.appendChild(s);

    fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'spotriHelpFab';
    fab.setAttribute('translate', 'no');
    fab.innerHTML = `<img src="${FACE}" alt="" draggable="false">`;
    fab.addEventListener('click', () => { hideTip(true); openPanel(); });
    document.body.appendChild(fab);

    tip = document.createElement('div');
    tip.id = 'spotriHelpTip';
    tip.setAttribute('translate', 'no');
    tip.setAttribute('role', 'button');
    tip.tabIndex = -1;
    tip.addEventListener('click', () => { hideTip(true); openPanel(); });
    document.body.appendChild(tip);

    root = document.createElement('div');
    root.id = 'spotriHelp';
    root.setAttribute('translate', 'no');
    root.innerHTML = `<div class="sh-back" data-sh-close></div>
      <div class="sh-panel" role="dialog" aria-modal="true" tabindex="-1">
        <div class="sh-grab" aria-hidden="true"></div>
        <div class="sh-head">
          <div class="sh-face"><img src="${FACE}" alt="" draggable="false"></div>
          <div><h2 id="shTitle"></h2><p id="shSub"></p></div>
          <button type="button" class="sh-x" data-sh-close>${svg('x')}</button>
        </div>
        <label class="sh-search">${svg('search')}<input type="search" id="shSearch" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search"></label>
        <div class="sh-body" id="shBody"></div>
        <div class="sh-foot">
          <a id="shMail" href="mailto:${MAIL}">${svg('mail')}<span></span></a>
          <button type="button" data-sh-guide>${svg('guide')}<span></span></button>
        </div>
      </div>`;
    document.body.appendChild(root);
    root.addEventListener('click', onClick);
    root.querySelector('#shSearch').addEventListener('input', e => {
      st.query = e.target.value;
      st.openItem = null;
      renderBody();
    });
    root.querySelector('#shSearch').addEventListener('keydown', e => { if(e.key === 'Enter') e.target.blur(); });
  }

  /* ---------- dibujo del panel ---------- */
  function itemHtml(f){
    const u = U(), l = lang(), d = f[l];
    const open = st.openItem === f.id;
    const fb = st.fb[f.id];
    return `<div class="sh-item${open ? ' open' : ''}">
      <button type="button" class="sh-q" data-sh-item="${f.id}" aria-expanded="${open}"><span>${d[0]}</span>${svg('down')}</button>
      <div class="sh-a">
        <p>${d[1]}</p>
        <button type="button" class="sh-go" data-sh-act="${f.act}">${d[2]}${svg('arrow')}</button>
        <div class="sh-fb">${fb ? `<span class="${fb === 'yes' ? 'ok' : ''}">${fb === 'yes' ? u.thanksYes : u.thanksNo}</span>`
          : `<span>${u.useful}</span><button type="button" data-sh-fb="yes" data-id="${f.id}">${u.yes}</button><button type="button" data-sh-fb="no" data-id="${f.id}">${u.no}</button>`}</div>
      </div>
    </div>`;
  }

  function renderBody(){
    const u = U(), l = lang();
    const body = root.querySelector('#shBody');
    const q = norm(st.query).trim();
    if(q){
      const words = q.split(/\s+/).filter(Boolean);
      const hits = FAQ.filter(f => { const txt = norm(f[l][0] + ' ' + f[l][1] + ' ' + f[l][2]); return words.every(w => txt.includes(w)); });
      body.innerHTML = `<p class="sh-label">${u.results}</p>` + (hits.length ? `<div class="sh-list">${hits.map(itemHtml).join('')}</div>` : `<p class="sh-none">${u.none}</p>`);
      return;
    }
    if(st.view === 'topic' && st.topic){
      const tp = TOPICS.find(x => x.id === st.topic);
      body.innerHTML = `<button type="button" class="sh-backbtn" data-sh-home>${svg('back')}${u.back}</button>
        <h3 class="sh-ttl">${tp[l]}</h3>
        <div class="sh-list">${FAQ.filter(f => f.t === st.topic).map(itemHtml).join('')}</div>`;
      return;
    }
    body.innerHTML = `<p class="sh-label">${u.topics}</p><div class="sh-topics">${TOPICS.map(tp => {
      const n = FAQ.filter(f => f.t === tp.id).length;
      return `<button type="button" class="sh-topic" data-sh-topic="${tp.id}">${svg(tp.ic)}<b>${tp[l]}</b><small>${n} ${u.q}</small></button>`;
    }).join('')}</div>`;
  }

  function renderShell(){
    const u = U();
    root.querySelector('.sh-panel').setAttribute('aria-label', u.title);
    root.querySelector('#shTitle').textContent = u.title;
    root.querySelector('#shSub').textContent = u.sub;
    root.querySelector('.sh-x').setAttribute('aria-label', u.close);
    const inp = root.querySelector('#shSearch');
    inp.placeholder = u.search;
    inp.setAttribute('aria-label', u.search);
    root.querySelector('#shMail span').textContent = u.mail;
    root.querySelector('#shMail').href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent('Ayuda SPOTRA');
    root.querySelector('[data-sh-guide] span').textContent = u.guide;
    renderBody();
  }

  function onClick(e){
    const el = e.target.closest('[data-sh-close],[data-sh-topic],[data-sh-home],[data-sh-item],[data-sh-act],[data-sh-fb],[data-sh-guide]');
    if(!el) return;
    if(el.hasAttribute('data-sh-close')){ closePanel(); return; }
    if(el.dataset.shTopic){ st.view = 'topic'; st.topic = el.dataset.shTopic; st.openItem = null; renderBody(); root.querySelector('#shBody').scrollTop = 0; return; }
    if(el.hasAttribute('data-sh-home')){ st.view = 'home'; st.topic = null; st.openItem = null; renderBody(); return; }
    if(el.dataset.shItem){
      const id = el.dataset.shItem;
      st.openItem = st.openItem === id ? null : id;
      renderBody();
      const b = root.querySelector(`[data-sh-item="${id}"]`);
      if(b){ b.focus({ preventScroll: true }); if(st.openItem) b.closest('.sh-item').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      return;
    }
    if(el.dataset.shFb){ st.fb[el.dataset.id] = el.dataset.shFb; renderBody(); return; }
    if(el.dataset.shAct){ run(el.dataset.shAct); return; }
    if(el.hasAttribute('data-sh-guide')){ run('guide'); return; }
  }

  function run(act){
    const fn = ACT[act];
    if(act === 'mail'){ if(fn) fn(); return; }
    closePanel(true);
    setTimeout(() => { try { if(fn) fn(); } catch(err){ console.warn('[SPOTRA] ayuda:', err); } }, 220);
  }

  function onKey(e){
    if(!st.open) return;
    if(e.key === 'Escape'){ e.preventDefault(); closePanel(); return; }
    if(e.key === 'Tab'){
      const f = Array.from(root.querySelectorAll('button,a[href],input')).filter(x => x.offsetParent !== null);
      if(!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
  }

  function openPanel(){
    ensureDom();
    st.open = true; st.view = 'home'; st.topic = null; st.query = ''; st.openItem = null;
    root.querySelector('#shSearch').value = '';
    lastFocus = document.activeElement;
    renderShell();
    root.classList.add('open');
    document.body.classList.add('spotri-help-open');
    document.addEventListener('keydown', onKey, true);
    updateFab();
    setTimeout(() => { try { root.querySelector('.sh-panel').focus({ preventScroll: true }); } catch(e){} }, 30);
  }

  function closePanel(silent){
    if(!root || !st.open) return;
    st.open = false;
    root.classList.remove('open');
    document.body.classList.remove('spotri-help-open');
    document.removeEventListener('keydown', onKey, true);
    const a = document.activeElement; if(a && root.contains(a)) a.blur();
    if(!silent){ try { if(lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch(e){} }
    updateFab();
  }

  /* ---------- botón flotante: cuándo se ve y dónde va ---------- */
  function visible(el){
    if(!el) return null;
    const cs = getComputedStyle(el);
    if(cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return null;
    const r = el.getBoundingClientRect();
    if(r.width < 2 || r.height < 2) return null;
    return r;
  }
  function shouldShow(){
    const b = document.body;
    if(!b) return false;
    if(b.classList.contains('auth-mode') || b.classList.contains('spotri-open') || st.open) return false;
    const h = location.hash;
    if(h === '#login' || h === '#signup' || h === '#signin') return false;
    if(document.querySelector('.modal-bg.open, #geoHelp.open')) return false;
    return true;
  }
  const SIZE = 52, GAP = 12;
  function place(){
    const vw = window.innerWidth, vh = window.innerHeight;
    // computadora/tablet ancha: en la barra de arriba, a la izquierda de la campana (no tapa contenido)
    const bell = vw >= 761 ? visible(document.querySelector('.notif-wrap')) : null;
    if(bell && bell.top < 140){
      const sz = 44;
      fab.style.width = fab.style.height = sz + 'px';
      fab.style.top = Math.round(bell.top + (bell.height - sz) / 2) + 'px';
      fab.style.bottom = 'auto';
      fab.style.right = Math.round(vw - bell.left + 10) + 'px';
      if(tip.classList.contains('show')){
        tip.style.top = Math.round(bell.top + (bell.height - sz) / 2 + sz + 10) + 'px';
        tip.style.bottom = 'auto';
        tip.style.right = Math.round(vw - bell.left + 10) + 'px';
        tip.style.borderRadius = '16px 4px 16px 16px';
      }
      return;
    }
    // celular: abajo a la derecha, arriba del +, del botón de ubicación y de la barra inferior
    let top = vh, right = 16;
    const plus = visible(document.querySelector('.fab'));
    const loc = visible(document.getElementById('mapLocateBtn'));
    const nav = visible(document.querySelector('.bottom-nav'));
    [plus, loc].forEach(r => { if(r && r.right > vw - 140) top = Math.min(top, r.top); });
    if(nav) top = Math.min(top, nav.top);
    const anchor = plus || loc;
    if(anchor && anchor.right > vw - 140) right = Math.max(8, Math.round(vw - anchor.right + (anchor.width - SIZE) / 2));
    const bottom = top < vh ? Math.round(vh - top + GAP) : 24;
    fab.style.width = fab.style.height = SIZE + 'px';
    fab.style.top = 'auto';
    fab.style.right = right + 'px';
    fab.style.bottom = bottom + 'px';
    if(tip.classList.contains('show')){
      tip.style.top = 'auto';
      tip.style.right = (right + SIZE + 10) + 'px';
      tip.style.bottom = (bottom + 8) + 'px';
      tip.style.borderRadius = '';
    }
  }
  function updateFab(){
    if(!fab) return;
    const show = shouldShow();
    fab.classList.toggle('show', show);
    fab.setAttribute('aria-label', U().fab);
    fab.title = U().fab;
    if(show){ place(); maybeTip(); }
    else hideTip(false);
  }

  /* ---------- burbuja "¿Necesitas ayuda?" (solo la primera vez) ---------- */
  let tipTimer = null, tipArmed = false;
  function tipSeen(){ try { return localStorage.getItem(TIP_KEY) === '1'; } catch(e){ return true; } }
  function maybeTip(){
    if(tipArmed || tipSeen()) return;
    tipArmed = true;
    setTimeout(() => {
      if(!shouldShow()){ tipArmed = false; return; }
      tip.textContent = U().tip;
      tip.classList.add('show');
      place();
      try { localStorage.setItem(TIP_KEY, '1'); } catch(e){}
      tipTimer = setTimeout(() => hideTip(false), 7000);
    }, 2500);
  }
  function hideTip(mark){
    if(!tip) return;
    tip.classList.remove('show');
    if(tipTimer){ clearTimeout(tipTimer); tipTimer = null; }
    if(mark){ try { localStorage.setItem(TIP_KEY, '1'); } catch(e){} }
  }

  /* ---------- arranque ---------- */
  function boot(){
    ensureDom();
    updateFab();
    setInterval(updateFab, 700);
    window.addEventListener('resize', updateFab);
    window.addEventListener('hashchange', updateFab);
    window.addEventListener('spotra-lang', () => { updateFab(); if(st.open) renderShell(); });
    document.addEventListener('click', () => setTimeout(updateFab, 60));
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.SpotraHelp = { open: openPanel, close: closePanel };
})();
