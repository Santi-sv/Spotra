/* SPOTRA · Idiomas (español, português, english)
   La app está escrita en español. Este módulo traduce lo que aparece en pantalla
   (textos, placeholders y avisos) según el idioma elegido. Lo que no está en el
   diccionario queda en español. Clave compartida con la landing: spotra_lang. */
(function(){
  // 'texto en español': ['português', 'english']
  const D = {
    // ---- navegación y general
    'Navegación principal':['Navegação principal','Main navigation'],'Navegación rider':['Navegação rider','Rider navigation'],
    'Mapa':['Mapa','Map'],'Eventos':['Eventos','Events'],'Foro':['Fórum','Forum'],'Market':['Market','Market'],'Perfil':['Perfil','Profile'],
    'Notificaciones':['Notificações','Notifications'],'Sin novedades por ahora.':['Nenhuma novidade por enquanto.','Nothing new for now.'],
    'Iniciar sesión':['Entrar','Log in'],'Crear cuenta':['Criar conta','Sign up'],'Crear':['Criar','Create'],'Cancelar':['Cancelar','Cancel'],
    'Enviar':['Enviar','Send'],'Eliminar':['Excluir','Delete'],'Editar':['Editar','Edit'],'Publicar':['Publicar','Post'],'Guardar cambios':['Salvar alterações','Save changes'],
    'Enviando...':['Enviando...','Sending...'],'Guardando...':['Salvando...','Saving...'],'Publicando...':['Publicando...','Posting...'],'Eliminando...':['Excluindo...','Deleting...'],
    'Salir':['Sair','Log out'],'Todos':['Todos','All'],'Todas':['Todas','All'],'Todo':['Tudo','All'],'Hoy':['Hoje','Today'],'Mañana':['Amanhã','Tomorrow'],
    // ---- mapa
    'Spots':['Spots','Spots'],'Skateparks':['Pistas','Skateparks'],'Tiendas':['Lojas','Shops'],'Sesiones':['Sessões','Sessions'],'Lista':['Lista','List'],
    'Buscar spots, skateparks, tiendas...':['Buscar spots, pistas, lojas...','Search spots, skateparks, shops...'],
    'Lugares en esta zona':['Lugares nesta região','Places in this area'],'Sesiones activas':['Sessões ativas','Active sessions'],
    'Cerrar lista':['Fechar lista','Close list'],'Cerrar ficha':['Fechar ficha','Close card'],'Elegí un lugar':['Escolha um lugar','Pick a place'],
    'Tocá un pin del mapa para ver su ficha.':['Toque em um pin do mapa para ver a ficha.','Tap a pin on the map to see its details.'],
    'Próximos eventos':['Próximos eventos','Upcoming events'],'Cómo llegar':['Como chegar','Directions'],'Subir foto':['Enviar foto','Upload photo'],
    'Agregar a SPOTRA':['Adicionar ao SPOTRA','Add to SPOTRA'],'Localizarme':['Minha localização','Locate me'],'Tu ubicación':['Sua localização','Your location'],
    'Portada':['Capa','Cover'],'Mapa Google de SPOTRA':['Mapa Google do SPOTRA','SPOTRA Google map'],'Resultado de Google Places':['Resultado do Google Places','Google Places result'],
    'Skatepark':['Pista de skate','Skatepark'],'Tienda':['Loja','Shop'],'Spot':['Spot','Spot'],'Street':['Street','Street'],'Lugar':['Lugar','Place'],'Evento':['Evento','Event'],
    'Todavía no hay sesiones activas. Creá una desde la ficha de un spot.':['Ainda não há sessões ativas. Crie uma pela ficha de um spot.','No active sessions yet. Create one from a spot card.'],
    'No hay lugares en esta zona. Alejá el mapa para ver más.':['Não há lugares nesta região. Afaste o mapa para ver mais.','No places in this area. Zoom out to see more.'],
    'Tu dispositivo no permite ubicación.':['Seu dispositivo não permite localização.','Your device does not support location.'],
    'Buscando tu ubicación...':['Buscando sua localização...','Finding your location...'],
    'No pudimos obtener tu ubicación. Revisá los permisos.':['Não conseguimos obter sua localização. Verifique as permissões.','We could not get your location. Check permissions.'],
    'Solo se pueden subir imágenes.':['Só é possível enviar imagens.','Only images can be uploaded.'],
    'La imagen es muy pesada (máx. 20 MB).':['A imagem é muito pesada (máx. 20 MB).','The image is too large (max 20 MB).'],
    'Procesando imagen...':['Processando imagem...','Processing image...'],
    'Foto enviada. Queda pendiente de aprobación.':['Foto enviada. Fica pendente de aprovação.','Photo sent. Pending approval.'],
    'No se pudo procesar la imagen.':['Não foi possível processar a imagem.','Could not process the image.'],
    'Portada actualizada.':['Capa atualizada.','Cover updated.'],'No se pudo cambiar la portada.':['Não foi possível trocar a capa.','Could not change the cover.'],
    'Enviado a aprobación':['Enviado para aprovação','Sent for approval'],
    'Lugar enviado. Queda pendiente de aprobación.':['Lugar enviado. Fica pendente de aprovação.','Place sent. Pending approval.'],
    'Iniciá sesión para sumar lugares a SPOTRA.':['Entre para adicionar lugares ao SPOTRA.','Log in to add places to SPOTRA.'],
    'No se pudo enviar el lugar. Probá de nuevo.':['Não foi possível enviar o lugar. Tente de novo.','Could not send the place. Try again.'],
    'No se pudo cargar el mapa. Revisá tu conexión e intentá de nuevo.':['Não foi possível carregar o mapa. Verifique sua conexão e tente de novo.','Could not load the map. Check your connection and try again.'],
    'No se pudo cargar el mapa. Revisá tu conexión.':['Não foi possível carregar o mapa. Verifique sua conexão.','Could not load the map. Check your connection.'],
    'Ubicación marcada. Ajustá el pin si hace falta.':['Localização marcada. Ajuste o pin se precisar.','Location set. Adjust the pin if needed.'],
    'No pudimos obtener tu ubicación. Marcá el punto tocando el mapa.':['Não conseguimos obter sua localização. Marque o ponto tocando no mapa.','We could not get your location. Tap the map to set the point.'],
    'Sin ubicación':['Sem localização','No location'],
    // ---- agregar spot
    'Spot o skatepark':['Spot ou pista','Spot or skatepark'],'Sumalo al mapa colaborativo. Pasa por aprobación.':['Adicione ao mapa colaborativo. Passa por aprovação.','Add it to the shared map. Needs approval.'],
    'Queda':['Fica','It stays'],'pendiente de aprobación':['pendente de aprovação','pending approval'],'antes de aparecer en el mapa.':['antes de aparecer no mapa.','before it shows on the map.'],
    'Nombre del spot (ej. Ledges del Buen Pastor)':['Nome do spot (ex. Ledges do Centro)','Spot name (e.g. Downtown Ledges)'],
    'Ciudad y país (ej. Córdoba, Argentina)':['Cidade e país (ex. Florianópolis, Brasil)','City and country (e.g. Córdoba, Argentina)'],
    'Descripción corta (obstáculos, superficie, horarios)':['Descrição curta (obstáculos, piso, horários)','Short description (obstacles, surface, hours)'],
    'Tocá el mapa para marcar el lugar':['Toque no mapa para marcar o lugar','Tap the map to mark the place'],'Usar mi ubicación':['Usar minha localização','Use my location'],
    'Subí una foto del spot':['Envie uma foto do spot','Upload a photo of the spot'],'Tocá o arrastrá la imagen':['Toque ou arraste a imagem','Tap or drag the image'],
    'Foto lista':['Foto pronta','Photo ready'],'Archivo listo':['Arquivo pronto','File ready'],'Enviar a aprobación':['Enviar para aprovação','Send for approval'],
    // ---- sesiones
    'Crear sesión':['Criar sessão','Create session'],'Avisá dónde y cuándo vas a rodar':['Avise onde e quando você vai andar','Let others know where and when you ride'],
    'Se publica':['É publicada','It is published'],'al instante':['na hora','instantly'],'y se ve en el mapa hasta que termina.':['e aparece no mapa até terminar.','and shows on the map until it ends.'],
    'Día':['Dia','Day'],'Otro día':['Outro dia','Another day'],'Desde':['Das','From'],'Hasta':['Até','To'],'Disciplina':['Modalidade','Discipline'],
    'Nota (opcional): traigo cajón':['Nota (opcional): levo caixote','Note (optional): bringing a box'],'Publicar sesión':['Publicar sessão','Post session'],
    'Terminar sesión':['Encerrar sessão','End session'],'Me bajo':['Vou sair','Leave'],'Me sumo':['Eu vou','Join'],'va a rodar':['vai andar','is riding'],
    'Crear sesión acá':['Criar sessão aqui','Create session here'],'Iniciá sesión para crear sesiones.':['Entre para criar sessões.','Log in to create sessions.'],
    'Elegí un spot de SPOTRA en el mapa.':['Escolha um spot do SPOTRA no mapa.','Pick a SPOTRA spot on the map.'],'Completá día y horario.':['Preencha dia e horário.','Fill in day and time.'],
    'La sesión no puede empezar en el pasado.':['A sessão não pode começar no passado.','The session cannot start in the past.'],
    'Solo podés crear sesiones hasta 7 días adelante.':['Só é possível criar sessões até 7 dias à frente.','You can only create sessions up to 7 days ahead.'],
    'Solo podés crear sesiones hasta 7 días adelante':['Só é possível criar sessões até 7 dias à frente','You can only create sessions up to 7 days ahead'],
    'La sesión puede durar hasta 8 horas.':['A sessão pode durar até 8 horas.','A session can last up to 8 hours.'],
    'Sesión publicada. Ya se ve en el mapa.':['Sessão publicada. Já aparece no mapa.','Session posted. It is on the map now.'],
    'No se pudo publicar. Revisá tu conexión.':['Não foi possível publicar. Verifique sua conexão.','Could not post. Check your connection.'],
    'Iniciá sesión para usar las sesiones.':['Entre para usar as sessões.','Log in to use sessions.'],
    '¿Terminar la sesión? Deja de verse en el mapa.':['Encerrar a sessão? Ela sai do mapa.','End the session? It will leave the map.'],
    'No se pudo completar. Probá de nuevo.':['Não foi possível concluir. Tente de novo.','Could not complete. Try again.'],
    'Te sumaste a la sesión.':['Você entrou na sessão.','You joined the session.'],'Te bajaste de la sesión.':['Você saiu da sessão.','You left the session.'],'Sesión terminada.':['Sessão encerrada.','Session ended.'],
    'Tocá un spot en el mapa y después «Crear sesión acá».':['Toque em um spot no mapa e depois em «Criar sessão aqui».','Tap a spot on the map, then «Create session here».'],
    'Todavía no se sumó nadie.':['Ninguém entrou ainda.','Nobody has joined yet.'],'Sé el primero en sumarte.':['Seja o primeiro a entrar.','Be the first to join.'],
    'Ya tenés 3 sesiones activas. Esperá a que termine alguna.':['Você já tem 3 sessões ativas. Espere uma terminar.','You already have 3 active sessions. Wait for one to end.'],
    'El spot no existe o no está aprobado.':['O spot não existe ou não está aprovado.','The spot does not exist or is not approved.'],
    'Completá tu perfil antes de crear una sesión.':['Complete seu perfil antes de criar uma sessão.','Complete your profile before creating a session.'],
    'Completá tu perfil antes de sumarte.':['Complete seu perfil antes de entrar.','Complete your profile before joining.'],
    'Esta sesión ya terminó.':['Esta sessão já terminou.','This session has already ended.'],'La sesión no existe.':['A sessão não existe.','The session does not exist.'],
    'Ya sos el organizador de esta sesión.':['Você já é o organizador desta sessão.','You are already hosting this session.'],'Tenés que iniciar sesión.':['Você precisa entrar.','You need to log in.'],
    // ---- menú crear
    '¿Qué querés sumar a la comunidad?':['O que você quer compartilhar com a comunidade?','What do you want to add to the community?'],
    'Publicación del foro':['Post no fórum','Forum post'],'Compartí una sesión, un clip, una duda o un spot.':['Compartilhe uma sessão, um clipe, uma dúvida ou um spot.','Share a session, a clip, a question or a spot.'],
    'Competencia o evento':['Competição ou evento','Contest or event'],'Organizá una fecha en un spot existente.':['Organize uma data em um spot existente.','Set up a date at an existing spot.'],
    'Producto usado':['Produto usado','Used product'],'Vendé lo que ya no uses en el marketplace.':['Venda o que você não usa mais no marketplace.','Sell what you no longer use on the marketplace.'],
    // ---- eventos
    'Competencias y juntadas':['Competições e encontros','Contests and meetups'],'Próximos':['Próximos','Upcoming'],'Mis eventos':['Meus eventos','My events'],'Ranking':['Ranking','Ranking'],
    'Cargando eventos...':['Carregando eventos...','Loading events...'],'Pendiente de aprobación':['Pendente de aprovação','Pending approval'],'Aprobado':['Aprovado','Approved'],
    'Rechazado':['Recusado','Rejected'],'Cancelado':['Cancelado','Canceled'],'Inscripto':['Inscrito','Registered'],'Inscripto en:':['Inscrito em:','Registered in:'],
    'No hay eventos próximos':['Não há eventos próximos','No upcoming events'],'de esa disciplina':['dessa modalidade','for that discipline'],
    'Cargando tus eventos...':['Carregando seus eventos...','Loading your events...'],'Iniciá sesión para ver tus eventos.':['Entre para ver seus eventos.','Log in to see your events.'],
    'Organizás vos':['Você organiza','You are hosting'],'Cargando ranking...':['Carregando ranking...','Loading ranking...'],'No se pudo abrir el evento.':['Não foi possível abrir o evento.','Could not open the event.'],
    'Inscripción:':['Inscrição:','Entry:'],'Premios:':['Prêmios:','Prizes:'],'Categorías':['Categorias','Categories'],'Info del evento':['Informações do evento','Event info'],
    'Evento cancelado':['Evento cancelado','Event canceled'],'Evento cancelado.':['Evento cancelado.','Event canceled.'],'Cargar resultados':['Enviar resultados','Add results'],'Cancelar evento':['Cancelar evento','Cancel event'],
    'Este evento fue cancelado por el organizador.':['Este evento foi cancelado pelo organizador.','This event was canceled by the organizer.'],
    'Cancelar inscripción':['Cancelar inscrição','Cancel registration'],'Este evento ya pasó.':['Este evento já passou.','This event is over.'],'Cupo completo':['Vagas esgotadas','Full'],
    'La inscripción cerró.':['As inscrições encerraram.','Registration is closed.'],'Inscribirme':['Me inscrever','Register'],'Contactar':['Contatar','Contact'],
    'Volver a eventos':['Voltar para eventos','Back to events'],'Van':['Vão','Going'],'Resultados':['Resultados','Results'],'Todavía no hay inscriptos.':['Ainda não há inscritos.','No one has registered yet.'],
    'Buscar por nombre o ciudad...':['Buscar por nome ou cidade...','Search by name or city...'],'Cancelando evento...':['Cancelando evento...','Canceling event...'],
    'No se pudo cancelar. Probá de nuevo.':['Não foi possível cancelar. Tente de novo.','Could not cancel. Try again.'],
    'Completá nombre, fecha y hora.':['Preencha nome, data e hora.','Fill in name, date and time.'],'Elegí el spot del evento en el mapa.':['Escolha o spot do evento no mapa.','Pick the event spot on the map.'],
    'Fecha u hora inválida.':['Data ou hora inválida.','Invalid date or time.'],'La fecha del evento ya pasó. Elegí una futura.':['A data do evento já passou. Escolha uma futura.','The event date has passed. Pick a future one.'],
    'El cierre de inscripción no puede ser después del evento.':['O fim das inscrições não pode ser depois do evento.','Registration cannot close after the event.'],
    'Iniciá sesión para crear un evento.':['Entre para criar um evento.','Log in to create an event.'],'No se pudo guardar el evento. Probá de nuevo.':['Não foi possível salvar o evento. Tente de novo.','Could not save the event. Try again.'],
    'Cambios guardados.':['Alterações salvas.','Changes saved.'],'Evento enviado. Queda pendiente de aprobación.':['Evento enviado. Fica pendente de aprovação.','Event sent. Pending approval.'],
    'Todavía no hay eventos publicados. Creá el primero desde el botón +.':['Ainda não há eventos publicados. Crie o primeiro pelo botão +.','No events yet. Create the first one with the + button.'],
    'No hay eventos próximos. Creá el primero desde el botón +.':['Não há eventos próximos. Crie o primeiro pelo botão +.','No upcoming events. Create the first one with the + button.'],
    'El evento queda':['O evento fica','The event stays'],'y se publica en el spot elegido.':['e é publicado no spot escolhido.','and is posted at the chosen spot.'],
    'Nombre del evento':['Nome do evento','Event name'],'Best Trick Sábado':['Best Trick Sábado','Saturday Best Trick'],'Spot donde se hace':['Spot onde acontece','Spot where it happens'],
    'Elegir spot en el mapa':['Escolher spot no mapa','Pick spot on the map'],'Fecha':['Data','Date'],'Hora':['Hora','Time'],'Info del evento (opcional)':['Informações do evento (opcional)','Event info (optional)'],
    'Reglas, protecciones, qué hay en el spot...':['Regras, proteções, o que tem no spot...','Rules, protection, what the spot has...'],'Para competencias':['Para competições','For contests'],
    '(todo opcional)':['(tudo opcional)','(all optional)'],'Categorías (separadas por coma)':['Categorias (separadas por vírgula)','Categories (comma separated)'],
    'Inscripción':['Inscrição','Entry'],'Gratis / $200 en puerta':['Grátis / R$20 na hora','Free / $5 at the door'],'Premios':['Prêmios','Prizes'],
    '$5.000 + productos de tiendas':['R$500 + produtos de lojas','$100 + shop products'],'Cupo máximo':['Vagas máximas','Max spots'],'Sin cupo':['Sem limite','No limit'],
    'Inscripción hasta':['Inscrições até','Registration until'],'WhatsApp del organizador':['WhatsApp do organizador','Organizer WhatsApp'],
    'Si llueve se reprograma':['Se chover, é remarcado','Rescheduled if it rains'],'Un admin lo revisa antes de publicarse':['Um admin revisa antes de publicar','An admin reviews it before posting'],
    // ---- foro
    'Comunidad':['Comunidade','Community'],'¿Qué estás haciendo?':['O que você está fazendo?','What are you up to?'],'Crear publicación':['Criar post','Create post'],
    'Cargando el foro...':['Carregando o fórum...','Loading the forum...'],'¿Qué querés compartir?':['O que você quer compartilhar?','What do you want to share?'],'Foto (opcional)':['Foto (opcional)','Photo (optional)'],
    'Publicar en foro':['Publicar no fórum','Post to forum'],
    '. Compartí una sesión, una pregunta o un hallazgo. Respetá a la comunidad: el admin puede eliminar publicaciones.':['. Compartilhe uma sessão, uma pergunta ou uma descoberta. Respeite a comunidade: o admin pode excluir posts.','. Share a session, a question or a find. Respect the community: the admin can remove posts.'],
    'Todavía no hay publicaciones. Sé el primero: contá dónde patinás hoy.':['Ainda não há posts. Seja o primeiro: conte onde você anda hoje.','No posts yet. Be the first: tell us where you ride today.'],
    'Todavía no hay publicaciones en el foro. Creá la primera.':['Ainda não há posts no fórum. Crie o primeiro.','No forum posts yet. Create the first one.'],
    'Cargando comentarios...':['Carregando comentários...','Loading comments...'],'Sin comentarios todavía.':['Sem comentários ainda.','No comments yet.'],
    'Escribí algo para publicar.':['Escreva algo para publicar.','Write something to post.'],'Subiendo foto...':['Enviando foto...','Uploading photo...'],
    'Iniciá sesión para publicar.':['Entre para publicar.','Log in to post.'],'No se pudo publicar. Probá de nuevo.':['Não foi possível publicar. Tente de novo.','Could not post. Try again.'],
    'Publicado en el foro.':['Publicado no fórum.','Posted to the forum.'],'Iniciá sesión para dar me gusta.':['Entre para curtir.','Log in to like.'],'No se pudo. Probá de nuevo.':['Não deu certo. Tente de novo.','That did not work. Try again.'],
    'Iniciá sesión para comentar.':['Entre para comentar.','Log in to comment.'],'Escribí el comentario.':['Escreva o comentário.','Write the comment.'],'No se pudo comentar.':['Não foi possível comentar.','Could not comment.'],
    '¿Eliminar el comentario?':['Excluir o comentário?','Delete the comment?'],'No se pudo eliminar.':['Não foi possível excluir.','Could not delete.'],
    '¿Eliminar la publicación? No se puede deshacer.':['Excluir o post? Não dá para desfazer.','Delete the post? This cannot be undone.'],'Publicación eliminada.':['Post excluído.','Post deleted.'],
    // ---- market
    'Usados entre riders':['Usados entre riders','Used gear between riders'],'Explorar':['Explorar','Explore'],'Mis publicaciones':['Meus anúncios','My listings'],
    'Tablas':['Shapes','Decks'],'Ruedas':['Rodas','Wheels'],'Bicis':['Bikes','Bikes'],'Protecc.':['Proteção','Pads'],'Ropa':['Roupas','Clothing'],'Otros':['Outros','Other'],
    'Cerca de mí':['Perto de mim','Near me'],'Cargando publicaciones...':['Carregando anúncios...','Loading listings...'],'Pendiente':['Pendente','Pending'],'Publicado':['Publicado','Live'],
    'Retirado':['Retirado','Removed'],'hace 1 día':['há 1 dia','1 day ago'],'Cargando tus publicaciones...':['Carregando seus anúncios...','Loading your listings...'],
    'Todavía no publicaste nada. Tocá "Publicar" y vendé lo que ya no uses.':['Você ainda não publicou nada. Toque em "Publicar" e venda o que não usa mais.','You have not posted anything yet. Tap "Post" and sell what you no longer use.'],
    'Vendido':['Vendido','Sold'],'Marcar vendido':['Marcar como vendido','Mark as sold'],'No se pudo abrir la publicación.':['Não foi possível abrir o anúncio.','Could not open the listing.'],
    'Volver al market':['Voltar ao market','Back to market'],'Completá título, precio, ciudad y WhatsApp.':['Preencha título, preço, cidade e WhatsApp.','Fill in title, price, city and WhatsApp.'],
    'Subí al menos una foto del producto.':['Envie pelo menos uma foto do produto.','Upload at least one product photo.'],'Subiendo fotos...':['Enviando fotos...','Uploading photos...'],
    'No se pudieron subir las fotos. Probá de nuevo.':['Não foi possível enviar as fotos. Tente de novo.','Could not upload the photos. Try again.'],
    'Publicación enviada. Queda pendiente de aprobación.':['Anúncio enviado. Fica pendente de aprovação.','Listing sent. Pending approval.'],
    '¿Marcar como vendido? Deja de aparecer en el market.':['Marcar como vendido? Ele sai do market.','Mark as sold? It will leave the market.'],'Marcado como vendido.':['Marcado como vendido.','Marked as sold.'],
    'Obteniendo ubicación...':['Obtendo localização...','Getting location...'],'Ubicación lista ✓':['Localização pronta ✓','Location ready ✓'],'Máximo 3 fotos.':['Máximo 3 fotos.','Up to 3 photos.'],
    'Tu publicación pasa por':['Seu anúncio passa por','Your listing goes through'],'aprobación del admin':['aprovação do admin','admin approval'],
    '. La venta se coordina por WhatsApp, sin pagos en la app.':['. A venda é combinada pelo WhatsApp, sem pagamentos no app.','. Sales are arranged on WhatsApp, no payments in the app.'],
    'Fotos (hasta 3)':['Fotos (até 3)','Photos (up to 3)'],'Título':['Título','Title'],'Tabla 8.0 casi nueva':['Shape 8.0 quase novo','8.0 deck, almost new'],'Precio':['Preço','Price'],
    'Categoría':['Categoria','Category'],'Protecciones':['Proteções','Pads'],'Estado':['Estado','Condition'],'Nuevo':['Novo','New'],'Usado — como nuevo':['Usado — como novo','Used — like new'],
    'Usado — bueno':['Usado — bom','Used — good'],'Usado — con detalles':['Usado — com detalhes','Used — with wear'],'Descripción':['Descrição','Description'],
    'Detalles, uso, qué incluye, dónde entregás...':['Detalhes, uso, o que inclui, onde entrega...','Details, use, what is included, where you deliver...'],
    'Tu WhatsApp':['Seu WhatsApp','Your WhatsApp'],'Usar mi ubicación (para "cerca de mí")':['Usar minha localização (para "perto de mim")','Use my location (for "near me")'],
    // ---- perfil y configuración
    'Configuración':['Configurações','Settings'],'Privacidad, contacto, contraseña y seguridad de cuenta':['Privacidade, contato, senha e segurança da conta','Privacy, contact, password and account security'],
    'Gestioná tu perfil y la seguridad de tu cuenta desde un panel privado.':['Gerencie seu perfil e a segurança da sua conta em um painel privado.','Manage your profile and account security from a private panel.'],
    'Apariencia':['Aparência','Appearance'],'Automático':['Automático','Automatic'],'Noche':['Noite','Night'],'Idioma':['Idioma','Language'],
    'Automático: modo día de 06:00 a 21:00 y modo noche de 21:00 a 06:00.':['Automático: modo dia das 06:00 às 21:00 e modo noite das 21:00 às 06:00.','Automatic: day mode 06:00–21:00, night mode 21:00–06:00.'],
    'Activar notificaciones':['Ativar notificações','Turn on notifications'],'Desactivar notificaciones':['Desativar notificações','Turn off notifications'],
    'Cambiar a cuenta admin':['Mudar para conta admin','Switch to admin account'],'Nombre y apellido':['Nome e sobrenome','Full name'],'Contacto':['Contato','Contact'],
    'Cambiar contraseña':['Alterar senha','Change password'],'Cerrar sesión':['Sair da conta','Log out'],'Eliminar mi cuenta':['Excluir minha conta','Delete my account'],
    'Estos datos se usarán en tu perfil público y en postulaciones a sponsors.':['Esses dados aparecem no seu perfil público e nas candidaturas a patrocínios.','This info is used on your public profile and sponsor applications.'],
    'Nombre':['Nome','First name'],'Apellido':['Sobrenome','Last name'],'Usuario (@)':['Usuário (@)','Username (@)'],
    'Disciplina (Skate, BMX, Roller, Scooter)':['Modalidade (Skate, BMX, Roller, Patinete)','Discipline (Skate, BMX, Roller, Scooter)'],
    'Instagram (usuario o link)':['Instagram (usuário ou link)','Instagram (username or link)'],'TikTok (usuario o link)':['TikTok (usuário ou link)','TikTok (username or link)'],
    'Facebook (usuario o link)':['Facebook (usuário ou link)','Facebook (username or link)'],'Bio: contá quién sos como rider':['Bio: conte quem você é como rider','Bio: tell us who you are as a rider'],
    'Tu contacto privado solo se comparte con acciones aprobadas por vos.':['Seu contato privado só é compartilhado em ações aprovadas por você.','Your private contact is only shared with actions you approve.'],
    'Guardar contacto':['Salvar contato','Save contact'],'Confirmá que sos vos y escribí dos veces la nueva contraseña.':['Confirme que é você e escreva a nova senha duas vezes.','Confirm it is you and type the new password twice.'],
    'Contraseña actual':['Senha atual','Current password'],'Nueva contraseña (mín. 8)':['Nova senha (mín. 8)','New password (min 8)'],'Reingresar nueva contraseña':['Repetir nova senha','Repeat new password'],
    'Se borra tu cuenta y tu perfil para siempre: publicaciones, comentarios, productos e inscripciones. Los spots y fotos que aportaste quedan en el mapa sin tu nombre. No se puede deshacer.':['Sua conta e seu perfil são apagados para sempre: posts, comentários, produtos e inscrições. Os spots e fotos que você enviou ficam no mapa sem o seu nome. Não dá para desfazer.','Your account and profile are deleted forever: posts, comments, products and registrations. Spots and photos you added stay on the map without your name. This cannot be undone.'],
    'Escribí ELIMINAR para confirmar':['Digite ELIMINAR para confirmar','Type ELIMINAR to confirm'],'Escribí ELIMINAR para confirmar.':['Digite ELIMINAR para confirmar.','Type ELIMINAR to confirm.'],
    'Agregá tu':['Adicione seu','Add your'],'en Configuración → Editar perfil.':['em Configurações → Editar perfil.','in Settings → Edit profile.'],'Iniciá sesión.':['Entre na sua conta.','Log in.'],
    'El nombre es obligatorio.':['O nome é obrigatório.','Name is required.'],'Ese usuario (@) ya está tomado.':['Esse usuário (@) já está em uso.','That username (@) is taken.'],
    'Perfil actualizado.':['Perfil atualizado.','Profile updated.'],'Contacto actualizado.':['Contato atualizado.','Contact updated.'],'Completá las contraseñas.':['Preencha as senhas.','Fill in the passwords.'],
    'La nueva contraseña debe tener al menos 8 caracteres.':['A nova senha deve ter pelo menos 8 caracteres.','The new password must be at least 8 characters.'],
    'Las contraseñas nuevas no coinciden.':['As novas senhas não coincidem.','The new passwords do not match.'],'La contraseña actual es incorrecta.':['A senha atual está incorreta.','The current password is wrong.'],
    'Contraseña actualizada.':['Senha atualizada.','Password updated.'],'Sin conexión. Probá de nuevo.':['Sem conexão. Tente de novo.','No connection. Try again.'],
    'No se pudo eliminar la cuenta.':['Não foi possível excluir a conta.','Could not delete the account.'],'Tu cuenta fue eliminada.':['Sua conta foi excluída.','Your account was deleted.'],
    // ---- notificaciones push
    'Tu navegador no admite notificaciones push.':['Seu navegador não suporta notificações push.','Your browser does not support push notifications.'],
    'Para recibir avisos, instalá SPOTRA en tu pantalla de inicio: tocá Compartir y luego "Agregar a inicio". Después volvé acá y activalas.':['Para receber avisos, instale o SPOTRA na tela inicial: toque em Compartilhar e depois em "Adicionar à Tela de Início". Depois volte aqui e ative.','To get alerts, add SPOTRA to your home screen: tap Share, then "Add to Home Screen". Then come back and turn them on.'],
    'Bloqueaste las notificaciones. Podés habilitarlas desde los ajustes del navegador para SPOTRA.':['Você bloqueou as notificações. Dá para liberar nos ajustes do navegador para o SPOTRA.','You blocked notifications. You can enable them in the browser settings for SPOTRA.'],
    'Sin conexión con el servidor.':['Sem conexão com o servidor.','No connection to the server.'],'Iniciá sesión para activar las notificaciones.':['Entre para ativar as notificações.','Log in to turn on notifications.'],
    'No se activaron las notificaciones.':['As notificações não foram ativadas.','Notifications were not turned on.'],
    'El servicio de notificaciones no está listo. Cerrá y abrí la app.':['O serviço de notificações não está pronto. Feche e abra o app.','The notification service is not ready. Close and reopen the app.'],
    'No se pudo guardar la suscripción.':['Não foi possível salvar a inscrição.','Could not save the subscription.'],'Notificaciones activadas.':['Notificações ativadas.','Notifications on.'],
    'No se pudo activar. Probá cerrar y abrir la app.':['Não foi possível ativar. Tente fechar e abrir o app.','Could not turn on. Try closing and reopening the app.'],
    'Notificaciones desactivadas.':['Notificações desativadas.','Notifications off.'],'No se pudo desactivar.':['Não foi possível desativar.','Could not turn off.'],
    // ---- login y registro
    'ENCONTRÁ':['ENCONTRE','FIND'],'SPOTS.':['SPOTS.','SPOTS.'],'CONECTÁ':['CONECTE','CONNECT'],'RIDERS.':['RIDERS.','RIDERS.'],'COMPETÍ.':['COMPITA.','COMPETE.'],'CRECÉ.':['CRESÇA.','GROW.'],
    'MAPA':['MAPA','MAP'],'USADOS':['USADOS','USED'],'Email o usuario':['Email ou usuário','Email or username'],'Contraseña':['Senha','Password'],'Mostrar contraseña':['Mostrar senha','Show password'],
    'Recordarme':['Lembrar de mim','Remember me'],'¿Olvidaste tu contraseña?':['Esqueceu sua senha?','Forgot your password?'],'ENTRAR A SPOTRA':['ENTRAR NO SPOTRA','ENTER SPOTRA'],'CREAR CUENTA':['CRIAR CONTA','SIGN UP'],
    'Mapa de spots':['Mapa de spots','Spot map'],'Eventos y competencias':['Eventos e competições','Events and contests'],'Comunidad rider':['Comunidade rider','Rider community'],
    'Tu perfil competitivo listo para marcas, spots aprobados y próximas competencias.':['Seu perfil competitivo pronto para marcas, spots aprovados e próximas competições.','Your competitive profile ready for brands, approved spots and upcoming contests.'],
    'perfil completo':['perfil completo','profile complete'],'spots aprobados':['spots aprovados','approved spots'],'matches abiertos':['matches abertos','open matches'],
    'Volver a iniciar sesión':['Voltar para entrar','Back to log in'],'Creá':['Crie','Create'],'tu cuenta':['sua conta','your account'],
    'Elegí el tipo de cuenta que mejor te representa y armá tu acceso al ecosistema SPOTRA.':['Escolha o tipo de conta que mais combina com você e monte seu acesso ao ecossistema SPOTRA.','Choose the account type that fits you best and set up your access to SPOTRA.'],
    'Nombre completo':['Nome completo','Full name'],'Celular':['Celular','Phone'],'Contraseña (mín. 8)':['Senha (mín. 8)','Password (min 8)'],'Ciudad':['Cidade','City'],
    'País de inicio':['País','Home country'],'Scooter':['Patinete','Scooter'],'Crear mi SPOTRA ID':['Criar meu SPOTRA ID','Create my SPOTRA ID'],
    'Al crear tu cuenta aceptás los':['Ao criar sua conta você aceita os','By signing up you accept the'],'Términos':['Termos','Terms'],'y la':['e a','and the'],
    'Política de Privacidad':['Política de Privacidade','Privacy Policy'],'Acceso':['Acesso','Access'],'Email o celular':['Email ou celular','Email or phone'],'Entrar':['Entrar','Enter'],
    'Revisá los campos marcados en rojo.':['Revise os campos marcados em vermelho.','Check the fields marked in red.'],'Sesión cerrada.':['Você saiu da conta.','Logged out.'],
    'Completá email y contraseña.':['Preencha email e senha.','Fill in email and password.'],'No hay conexión con el backend.':['Sem conexão com o servidor.','No connection to the server.'],
    'Ese email ya tiene una cuenta. Iniciá sesión.':['Esse email já tem uma conta. Entre.','That email already has an account. Log in.'],
    'Te enviamos un email para confirmar tu cuenta. Confirmalo y luego iniciá sesión.':['Enviamos um email para confirmar sua conta. Confirme e depois entre.','We sent you an email to confirm your account. Confirm it and then log in.'],
    'Por ahora el ingreso es con email. Usá tu email registrado.':['Por enquanto o acesso é com email. Use seu email cadastrado.','For now, log in with email. Use your registered email.'],
    'Ingresando...':['Entrando...','Logging in...'],'La conexión tardó demasiado. Reintentá en unos segundos.':['A conexão demorou demais. Tente de novo em alguns segundos.','The connection took too long. Retry in a few seconds.'],
    'Email o contraseña incorrectos.':['Email ou senha incorretos.','Wrong email or password.'],'Tenés que confirmar tu email antes de entrar.':['Você precisa confirmar seu email antes de entrar.','You need to confirm your email before logging in.'],
    'Ese email ya tiene una cuenta.':['Esse email já tem uma conta.','That email already has an account.'],'La contraseña debe tener al menos 6 caracteres.':['A senha deve ter pelo menos 6 caracteres.','The password must be at least 6 characters.'],
    'Escribí tu email arriba y tocá de nuevo "Olvidaste tu contraseña".':['Escreva seu email acima e toque de novo em "Esqueceu sua senha".','Type your email above and tap "Forgot your password" again.'],
    'Enviando enlace de recuperación...':['Enviando link de recuperação...','Sending recovery link...'],
    'Si ese email tiene cuenta, te enviamos un enlace para recuperar la contraseña.':['Se esse email tiver conta, enviamos um link para recuperar a senha.','If that email has an account, we sent you a link to reset the password.'],
    'No se pudo enviar el enlace. Reintentá en unos segundos.':['Não foi possível enviar o link. Tente de novo em alguns segundos.','Could not send the link. Retry in a few seconds.'],
    'Nueva contraseña':['Nova senha','New password'],'Escribí dos veces tu nueva contraseña para tu cuenta de SPOTRA.':['Escreva duas vezes sua nova senha do SPOTRA.','Type your new SPOTRA password twice.'],
    'Guardar contraseña':['Salvar senha','Save password'],'La contraseña debe tener al menos 8 caracteres.':['A senha deve ter pelo menos 8 caracteres.','The password must be at least 8 characters.'],
    'Las contraseñas no coinciden.':['As senhas não coincidem.','The passwords do not match.'],
    'El enlace venció o ya se usó. Cerrá esto y pedí uno nuevo desde "Olvidaste tu contraseña".':['O link expirou ou já foi usado. Feche isto e peça um novo em "Esqueceu sua senha".','The link expired or was already used. Close this and request a new one from "Forgot your password".'],
    'Contraseña actualizada. Entrando...':['Senha atualizada. Entrando...','Password updated. Logging in...'],'Contraseña actualizada. Ya estás dentro de SPOTRA.':['Senha atualizada. Você já está no SPOTRA.','Password updated. You are in SPOTRA.'],
    // ---- reportar, bloquear y edad
    'Reportar':['Denunciar','Report'],'Reportar publicación':['Denunciar anúncio','Report listing'],'Usuarios bloqueados':['Usuários bloqueados','Blocked users'],
    'Tu fecha de nacimiento':['Sua data de nascimento','Your date of birth'],'Fecha de nacimiento':['Data de nascimento','Date of birth'],'¿Qué pasa?':['O que está acontecendo?','What is wrong?'],
    'Contanos más (opcional)':['Conte mais (opcional)','Tell us more (optional)'],'Bloquear también a':['Bloquear também','Also block'],'Enviar reporte':['Enviar denúncia','Send report'],
    'El admin lo revisa. La persona no sabe quién la reportó.':['O admin revisa. A pessoa não sabe quem denunciou.','The admin reviews it. The person does not know who reported them.'],
    'No ves nada de lo que publican. Ellos no se enteran.':['Você não vê nada do que publicam. Eles não ficam sabendo.','You will not see anything they post. They are not notified.'],
    'Para cuidar a los riders menores de edad, necesitamos tu fecha de nacimiento.':['Para proteger os riders menores de idade, precisamos da sua data de nascimento.','To protect underage riders, we need your date of birth.'],
    'No se muestra en tu perfil':['Não aparece no seu perfil','It is not shown on your profile'],'y no se puede cambiar después.':['e não pode ser alterada depois.','and cannot be changed later.'],
    'Guardar':['Salvar','Save'],'Spam o publicidad':['Spam ou propaganda','Spam or ads'],'Acoso o insultos':['Assédio ou insultos','Harassment or insults'],
    'Contenido inapropiado':['Conteúdo impróprio','Inappropriate content'],'Estafa o engaño':['Golpe ou fraude','Scam or fraud'],'Algo peligroso':['Algo perigoso','Something dangerous'],'Otro motivo':['Outro motivo','Other reason'],
    'Iniciá sesión para reportar.':['Entre para denunciar.','Log in to report.'],'Ya lo habías reportado.':['Você já tinha denunciado.','You already reported this.'],
    'Reporte enviado y usuario bloqueado.':['Denúncia enviada e usuário bloqueado.','Report sent and user blocked.'],'Gracias. El admin lo va a revisar.':['Obrigado. O admin vai revisar.','Thanks. The admin will review it.'],
    'Usuario bloqueado.':['Usuário bloqueado.','User blocked.'],'No se pudo desbloquear.':['Não foi possível desbloquear.','Could not unblock.'],'Usuario desbloqueado.':['Usuário desbloqueado.','User unblocked.'],
    'No bloqueaste a nadie.':['Você não bloqueou ninguém.','You have not blocked anyone.'],'Desbloquear':['Desbloquear','Unblock'],
    'Elegí tu fecha de nacimiento.':['Escolha sua data de nascimento.','Pick your date of birth.'],'Revisá la fecha de nacimiento.':['Confira a data de nascimento.','Check the date of birth.'],
    'Listo, gracias.':['Pronto, obrigado.','Done, thanks.'],'No se pudo guardar. Probá de nuevo.':['Não foi possível salvar. Tente de novo.','Could not save. Try again.'],
    'La fecha de nacimiento ya está guardada. Escribinos si hay un error.':['A data de nascimento já está salva. Fale com a gente se houver um erro.','Your date of birth is already saved. Contact us if it is wrong.'],
    'Llegaste al límite de reportes por hoy.':['Você chegou ao limite de denúncias de hoje.','You reached today\'s report limit.'],'No podés reportarte a vos mismo.':['Você não pode denunciar a si mesmo.','You cannot report yourself.'],
    'Seguir':['Seguir','Follow'],'Siguiendo':['Seguindo','Following'],'Seguidores':['Seguidores','Followers'],'Quitar':['Remover','Remove'],'Dejar de seguir':['Deixar de seguir','Unfollow'],
    'Iniciá sesión para seguir riders.':['Entre para seguir riders.','Log in to follow riders.'],'Dejaste de seguir a este rider.':['Você deixou de seguir este rider.','You unfollowed this rider.'],
    'Ahora seguís a este rider.':['Agora você segue este rider.','You now follow this rider.'],'Todavía no te sigue nadie.':['Ninguém segue você ainda.','Nobody follows you yet.'],
    'Todavía no seguís a nadie.':['Você ainda não segue ninguém.','You do not follow anyone yet.'],'No podés seguirte a vos mismo.':['Você não pode seguir a si mesmo.','You cannot follow yourself.'],
    'Llegaste al límite de riders seguidos por hoy.':['Você chegou ao limite de riders seguidos hoje.','You reached today\'s follow limit.'],'Ese rider no existe.':['Esse rider não existe.','That rider does not exist.'],
    'Buscando...':['Buscando...','Searching...'],'No encontramos ese lugar.':['Não encontramos esse lugar.','We could not find that place.'],
    'Buscar ciudad o dirección':['Buscar cidade ou endereço','Search city or address'],
    'El mapa cambia de idioma al reabrir la app.':['O mapa muda de idioma ao reabrir o app.','The map changes language when you reopen the app.']
  };

  // textos con partes variables
  const DAYW = { 'Hoy':['Hoje','Today'], 'Mañana':['Amanhã','Tomorrow'], 'En curso · hasta':['Em andamento · até','Live · until'] };
  const DISC = { 'Todas':['Todas','All'] };
  const P = [
    [/^(\d+) sesión hoy$/, (m,i) => m[1] + [' sessão hoje',' session today'][i]],
    [/^(\d+) sesiones hoy$/, (m,i) => m[1] + [' sessões hoje',' sessions today'][i]],
    [/^(\d+) sesión próxima$/, (m,i) => m[1] + [' sessão em breve',' upcoming session'][i]],
    [/^(\d+) sesiones próximas$/, (m,i) => m[1] + [' sessões em breve',' upcoming sessions'][i]],
    [/^(Publicación del foro|Comentario|Producto del market|Sesión|Usuario)( · @.*)?$/, (m,i) => ({'Publicación del foro':['Post do fórum','Forum post'],'Comentario':['Comentário','Comment'],'Producto del market':['Produto do market','Market listing'],'Sesión':['Sessão','Session'],'Usuario':['Usuário','User']})[m[1]][i] + (m[2] || '')],
    [/^1 se suma$/, (m,i) => ['1 vai','1 joining'][i]],
    [/^(\d+) se suman$/, (m,i) => m[1] + [' vão',' joining'][i]],
    [/^(Hoy|Mañana|En curso · hasta)( .*?)( · Todas)?$/, (m,i) => DAYW[m[1]][i] + m[2] + (m[3] ? ' · ' + DISC.Todas[i] : '')],
    [/^No se pudo guardar: (.*)$/, (m,i) => ['Não foi possível salvar: ','Could not save: '][i] + m[1]],
    [/^No se pudo cambiar: (.*)$/, (m,i) => ['Não foi possível alterar: ','Could not change: '][i] + m[1]],
    [/^No se pudo subir: (.*)$/, (m,i) => ['Não foi possível enviar: ','Could not upload: '][i] + m[1]],
    [/^Error al crear la cuenta: (.*)$/, (m,i) => ['Erro ao criar a conta: ','Sign-up error: '][i] + m[1]],
    [/^Error al iniciar sesión: (.*)$/, (m,i) => ['Erro ao entrar: ','Login error: '][i] + m[1]],
    [/^Cuenta creada\. Bienvenido a SPOTRA, (.*)$/, (m,i) => ['Conta criada. Bem-vindo ao SPOTRA, ','Account created. Welcome to SPOTRA, '][i] + m[1]],
    [/^Bienvenido de vuelta, (.*)$/, (m,i) => ['Bem-vindo de volta, ','Welcome back, '][i] + m[1]],
    [/^Ver inscriptos \((\d+)\)$/, (m,i) => ['Ver inscritos (','See registered ('][i] + m[1] + ')'],
    [/^Todavía no hay puntos en (.*)$/, (m,i) => ['Ainda não há pontos em ','No points yet in '][i] + m[1]],
    [/^— inscripción hasta (.*)$/, (m,i) => ['— inscrições até ','— registration until '][i] + m[1]],
    [/^¿Cancelar "(.*)"\? Los inscriptos lo verán como cancelado\. Esto no se puede deshacer\.$/, (m,i) => ['Cancelar "','Cancel "'][i] + m[1] + ['"? Os inscritos vão ver como cancelado. Não dá para desfazer.','"? Registered riders will see it as canceled. This cannot be undone.'][i]]
  ];

  const KEY = 'spotra_lang';
  function detect(){
    let v = '';
    try { v = localStorage.getItem(KEY) || ''; } catch(e){}
    if(!v) v = navigator.language || 'es';
    v = v.toLowerCase();
    return v.startsWith('pt') ? 'pt' : v.startsWith('en') ? 'en' : 'es';
  }
  let L = detect();
  const idx = () => (L === 'pt' ? 0 : 1);
  const norm = s => s.replace(/\s+/g, ' ').trim();

  function tr(s){
    if(L === 'es' || !s) return s;
    const k = norm(String(s));
    if(!k) return s;
    const e = D[k];
    if(e) return e[idx()];
    if(k.length < 200){
      for(const [re, fn] of P){
        const m = k.match(re);
        if(m) return fn(m, idx());
      }
    }
    return s;
  }

  function swap(orig){
    const k = norm(orig);
    const t = tr(k);
    if(t === k) return orig;
    const lead = orig.match(/^\s*/)[0], trail = orig.match(/\s*$/)[0];
    return lead + t + trail;
  }

  function skip(el){
    return !el || el.closest('script,style,textarea,[translate="no"],[contenteditable="true"],.google-map-canvas,.spotra-gate');
  }

  function doText(n){
    if(n.__i18nOut !== undefined && n.nodeValue !== n.__i18nOut) n.__i18n = undefined; // la app cambió el texto
    const orig = n.__i18n !== undefined ? n.__i18n : n.nodeValue;
    if(!orig || !/[A-Za-zÀ-ÿ]/.test(orig)) return;
    const out = L === 'es' ? orig : swap(orig);
    if(out !== n.nodeValue || n.__i18n !== undefined){
      n.__i18n = orig;
      n.__i18nOut = out;
      if(n.nodeValue !== out) n.nodeValue = out;
    }
  }

  const ATTRS = ['placeholder', 'aria-label', 'title'];
  function doAttrs(el){
    if(!el.__i18nA) el.__i18nA = {};
    ATTRS.forEach(a => {
      const cur = el.getAttribute(a);
      if(cur == null) return;
      const rec = el.__i18nA[a];
      const orig = rec && cur === rec.out ? rec.orig : cur;
      const out = L === 'es' ? orig : swap(orig);
      el.__i18nA[a] = { orig, out };
      if(cur !== out) el.setAttribute(a, out);
    });
  }

  function walk(root){
    if(!root) return;
    if(root.nodeType === 3){ if(!skip(root.parentElement)) doText(root); return; }
    if(root.nodeType !== 1 || skip(root)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while((n = w.nextNode())){ if(!skip(n.parentElement)) doText(n); }
    if(root.matches && root.matches('[placeholder],[aria-label],[title]')) doAttrs(root);
    root.querySelectorAll && root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(el => { if(!skip(el)) doAttrs(el); });
  }

  // traducir lo que los módulos agregan después
  let queue = new Set(), scheduled = false;
  function flush(){ scheduled = false; const q = queue; queue = new Set(); q.forEach(walk); }
  const obs = new MutationObserver(muts => {
    muts.forEach(m => {
      if(m.type === 'childList') m.addedNodes.forEach(n => queue.add(n));
      else if(m.type === 'characterData') queue.add(m.target);
      else if(m.type === 'attributes') queue.add(m.target);
    });
    if(!scheduled){ scheduled = true; requestAnimationFrame(flush); }
  });

  function syncUI(){
    document.documentElement.lang = L === 'pt' ? 'pt-BR' : L;
    document.querySelectorAll('#langSeg button').forEach(b => b.classList.toggle('active', b.dataset.langSet === L));
  }

  function setLang(v){
    if(v === L) return;
    L = v;
    let stored = '';
    try { stored = localStorage.getItem(KEY) || ''; } catch(e){}
    const code = v === 'pt' ? 'pt-br' : v === 'en' ? 'en' : (stored.startsWith('es') ? stored : 'es-uy');
    try { localStorage.setItem(KEY, code); } catch(e){}
    syncUI();
    walk(document.body);
    window.dispatchEvent(new Event('spotra-lang'));
    if(window.toast) window.toast(tr('El mapa cambia de idioma al reabrir la app.'));
  }

  // confirm() también traducido
  const nativeConfirm = window.confirm.bind(window);
  window.confirm = msg => nativeConfirm(tr(msg));

  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-lang-set]');
    if(b) setLang(b.dataset.langSet);
  });

  function start(){
    syncUI();
    walk(document.body);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if(document.body) start(); else document.addEventListener('DOMContentLoaded', start);

  window.SpotraI18n = { t: tr, lang: () => L, setLang, mapsLang: () => (L === 'pt' ? 'pt-BR' : L) };
})();
