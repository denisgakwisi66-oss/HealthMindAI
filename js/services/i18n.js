const LANGUAGE_KEY = 'healthmind-language';
const DEFAULT_LANGUAGE = 'en';

const entries = [
  ['Loading...', 'Chargement...', 'Birimo gupakira...'],
  ['Loading HealthMind AI...', 'Chargement de HealthMind AI...', 'HealthMind AI iri gupakira...'],
  ['Loading settings...', 'Chargement des paramètres...', 'Igenamiterere ririmo gupakira...'],
  ['Loading your dashboard...', 'Chargement de votre tableau de bord...', 'Paji mbuga yawe iri gupakira...'],
  ['Loading admin dashboard...', 'Chargement du tableau de bord administrateur...', 'Paji mbuga y’umuyobozi iri gupakira...'],
  ['Loading doctor dashboard...', 'Chargement du tableau de bord médecin...', 'Paji mbuga ya muganga iri gupakira...'],
  ['Loading analytics...', 'Chargement des statistiques...', 'Imibare iri gupakira...'],
  ['Loading appointments...', 'Chargement des rendez-vous...', 'Gahunda z’abarwayi zirimo gupakira...'],
  ['Loading medical records...', 'Chargement des dossiers médicaux...', 'Inyandiko z’ubuvuzi zirimo gupakira...'],
  ['Loading medications...', 'Chargement des médicaments...', 'Imiti iri gupakira...'],
  ['Loading notifications...', 'Chargement des notifications...', 'Ubutumwa burimo gupakira...'],
  ['Loading patients...', 'Chargement des patients...', 'Abarwayi barimo gupakira...'],
  ['Loading profile...', 'Chargement du profil...', 'Umwirondoro uri gupakira...'],
  ['Loading users...', 'Chargement des utilisateurs...', 'Abakoresha barimo gupakira...'],
  ['Loading emergency tools...', 'Chargement des outils d’urgence...', 'Ibikoresho by’ubutabazi biri gupakira...'],
  ['Loading AI Assistant...', 'Chargement de l’assistant IA...', 'Umufasha wa AI ari gupakira...'],
  ['Loading activity...', 'Chargement de l’activité...', 'Ibikorwa birimo gupakira...'],
  ['Loading conversations...', 'Chargement des conversations...', 'Ibiganiro birimo gupakira...'],
  ['Loading schedule...', 'Chargement du planning...', 'Gahunda iri gupakira...'],
  ['Loading chart...', 'Chargement du graphique...', 'Igishushanyo kiri gupakira...'],

  ['Home', 'Accueil', 'Ahabanza'],
  ['Features', 'Fonctionnalités', 'Ibiranga porogaramu'],
  ['How It Works', 'Comment ça marche', 'Uko ikora'],
  ['Main', 'Principal', 'Iby’ingenzi'],
  ['Management', 'Gestion', 'Imicungire'],
  ['Account', 'Compte', 'Konti'],
  ['AI', 'IA', 'AI'],
  ['Security', 'Sécurité', 'Umutekano'],
  ['About', 'À propos', 'Ibyerekeye'],
  ['About Us', 'À propos de nous', 'Ibyerekeye twe'],
  ['AI-POWERED', 'PROPULSÉ PAR L’IA', 'IKORESHWA NA AI'],
  ['Get in Touch', 'Contactez-nous', 'Twandikire'],
  ['Contact', 'Contact', 'Twandikire'],
  ['Log In', 'Se connecter', 'Injira'],
  ['Login', 'Connexion', 'Kwinjira'],
  ['Log Out', 'Se déconnecter', 'Sohoka'],
  ['Create Account', 'Créer un compte', 'Fungura konti'],
  ['Create one now', 'Créer un compte maintenant', 'Fungura konti ubu'],
  ['Already have an account?', 'Vous avez déjà un compte ?', 'Usanzwe ufite konti?'],
  ['Don’t have an account?', 'Vous n’avez pas de compte ?', 'Nta konti ufite?'],
  ["Don't have an account?", 'Vous n’avez pas de compte ?', 'Nta konti ufite?'],
  ['Welcome Back', 'Bon retour', 'Urakaza neza nanone'],
  ['Create Your Account', 'Créez votre compte', 'Fungura konti yawe'],
  ['Start your health journey today', 'Commencez votre parcours de santé aujourd’hui', 'Tangira urugendo rwawe rw’ubuzima uyu munsi'],
  ['Log in to your health assistant', 'Connectez-vous à votre assistant santé', 'Injira mu mufasha wawe w’ubuzima'],
  ['Email Address', 'Adresse e-mail', 'Aderesi ya imeri'],
  ['Password', 'Mot de passe', 'Ijambo ry’ibanga'],
  ['Enter your password', 'Saisissez votre mot de passe', 'Andika ijambo ry’ibanga'],
  ['you@example.com', 'vous@exemple.com', 'wowe@example.com'],
  ['Toggle password visibility', 'Afficher ou masquer le mot de passe', 'Erekanira cyangwa uhishe ijambo ry’ibanga'],
  ['Current Password', 'Mot de passe actuel', 'Ijambo ry’ibanga risanzwe'],
  ['New Password', 'Nouveau mot de passe', 'Ijambo ry’ibanga rishya'],
  ['Confirm Password', 'Confirmer le mot de passe', 'Emeza ijambo ry’ibanga'],
  ['Confirm New Password', 'Confirmer le nouveau mot de passe', 'Emeza ijambo ry’ibanga rishya'],
  ['Remember me', 'Se souvenir de moi', 'Nyibuka'],
  ['Forgot password?', 'Mot de passe oublié ?', 'Wibagiwe ijambo ry’ibanga?'],
  ['Send Reset Link', 'Envoyer le lien de réinitialisation', 'Ohereza umurongo wo guhindura ijambo ry’ibanga'],
  ['Reset Password', 'Réinitialiser le mot de passe', 'Hindura ijambo ry’ibanga'],
  ['We’ll send you a link to reset your password', 'Nous vous enverrons un lien pour réinitialiser votre mot de passe', 'Tuzakoherereza umurongo wo guhindura ijambo ry’ibanga'],
  ["We'll send you a link to reset your password", 'Nous vous enverrons un lien pour réinitialiser votre mot de passe', 'Tuzakoherereza umurongo wo guhindura ijambo ry’ibanga'],
  ['Check Your Email', 'Vérifiez votre e-mail', 'Reba imeri yawe'],
  ['Return to Log In', 'Retour à la connexion', 'Subira ku kwinjira'],
  ['Back to Log In', 'Retour à la connexion', 'Subira ku kwinjira'],
  ['or continue with', 'ou continuer avec', 'cyangwa ukomeze ukoresheje'],
  ['Google', 'Google', 'Google'],
  ['Apple', 'Apple', 'Apple'],
  ['Full Name', 'Nom complet', 'Amazina yose'],
  ['Phone', 'Téléphone', 'Telefone'],
  ['Phone Number', 'Numéro de téléphone', 'Nimero ya telefone'],
  ['(optional)', '(facultatif)', '(si ngombwa)'],
  ['Date of Birth', 'Date de naissance', 'Itariki y’amavuko'],
  ['I am a', 'Je suis', 'Ndi'],
  ['Select your role...', 'Sélectionnez votre rôle...', 'Hitamo uruhare rwawe...'],
  ['Patient', 'Patient', 'Umurwayi'],
  ['Patients', 'Patients', 'Abarwayi'],
  ['Doctor', 'Médecin', 'Muganga'],
  ['Doctors', 'Médecins', 'Abaganga'],
  ['Doctor / Healthcare Provider', 'Médecin / professionnel de santé', 'Muganga / inzobere mu buzima'],
  ['Admin', 'Administrateur', 'Umuyobozi'],
  ['Password must be at least 8 characters', 'Le mot de passe doit comporter au moins 8 caractères', 'Ijambo ry’ibanga rigomba kuba nibura inyuguti 8'],
  ['I agree to the', 'J’accepte les', 'Nemeye'],
  ['Terms of Service', 'Conditions d’utilisation', 'Amabwiriza yo gukoresha'],
  ['Privacy Policy', 'Politique de confidentialité', 'Politiki y’ibanga'],
  ['and', 'et', 'na'],
  ['Log in', 'Se connecter', 'Injira'],
  ['Log In', 'Se connecter', 'Injira'],
  ['Logging in...', 'Connexion en cours...', 'Kwinjira birimo gukorwa...'],
  ['Creating account...', 'Création du compte...', 'Konti irimo gufungurwa...'],

  ['Dashboard', 'Tableau de bord', 'Paji mbuga'],
  ['Login', 'Connexion', 'Kwinjira'],
  ['Create Account', 'Créer un compte', 'Fungura konti'],
  ['Reset Password', 'Réinitialiser le mot de passe', 'Hindura ijambo ry’ibanga'],
  ['Medical Records', 'Dossiers médicaux', 'Inyandiko z’ubuvuzi'],
  ['Users', 'Utilisateurs', 'Abakoresha'],
  ['Admin Dashboard', 'Tableau de bord administrateur', 'Paji mbuga y’umuyobozi'],
  ['Doctor Dashboard', 'Tableau de bord médecin', 'Paji mbuga ya muganga'],
  ['AI Assistant', 'Assistant IA', 'Umufasha wa AI'],
  ['AI Assistant — HealthMind AI', 'Assistant IA — HealthMind AI', 'Umufasha wa AI — HealthMind AI'],
  ['Appointments', 'Rendez-vous', 'Gahunda z’abarwayi'],
  ['Medical Records', 'Dossiers médicaux', 'Inyandiko z’ubuvuzi'],
  ['Patient Records', 'Dossiers des patients', 'Inyandiko z’abarwayi'],
  ['Medications', 'Médicaments', 'Imiti'],
  ['Notifications', 'Notifications', 'Ubutumwa'],
  ['Emergency', 'Urgence', 'Ubutabazi bwihuse'],
  ['Profile', 'Profil', 'Umwirondoro'],
  ['Settings', 'Paramètres', 'Igenamiterere'],
  ['Users', 'Utilisateurs', 'Abakoresha'],
  ['Users & Doctors', 'Utilisateurs et médecins', 'Abakoresha n’abaganga'],
  ['User Management', 'Gestion des utilisateurs', 'Gucunga abakoresha'],
  ['Analytics', 'Statistiques', 'Imibare'],
  ['Manage the care team', 'Gérer l’équipe de soins', 'Genzura itsinda ryita ku barwayi'],
  ['Add a Doctor', 'Ajouter un médecin', 'Ongeraho muganga'],
  ['Add Doctor', 'Ajouter un médecin', 'Ongeraho muganga'],
  ['Add User', 'Ajouter un utilisateur', 'Ongeraho ukoresha porogaramu'],
  ['Manage doctors and specialties →', 'Gérer les médecins et les spécialités →', 'Genzura abaganga n’inzobere →'],
  ['Create doctor accounts, assign specialties, and manage users and access from User Management.', 'Créez des comptes médecins, attribuez des spécialités et gérez les utilisateurs et leurs accès depuis la gestion des utilisateurs.', 'Fungura konti z’abaganga, ubahe inzobere, kandi ugenzure abakoresha n’uburenganzira bwabo.'],
  ['Total Users', 'Nombre total d’utilisateurs', 'Umubare w’abakoresha'],
  ['Total Patients', 'Nombre total de patients', 'Umubare w’abarwayi'],
  ['Total Patients', 'Nombre total de patients', 'Umubare w’abarwayi'],
  ['Total Doctors', 'Nombre total de médecins', 'Umubare w’abaganga'],
  ['Total Appointments', 'Nombre total de rendez-vous', 'Umubare wa gahunda z’abarwayi'],
  ['Today’s Appointments', 'Rendez-vous du jour', 'Gahunda z’uyu munsi'],
  ["Today's Appointments", 'Rendez-vous du jour', 'Gahunda z’uyu munsi'],
  ['Pending', 'En attente', 'Birategereje'],
  ['Completed Today', 'Terminés aujourd’hui', 'Byarangiye uyu munsi'],
  ['Hospitals', 'Hôpitaux', 'Ibitaro'],
  ['Recent Activity', 'Activité récente', 'Ibikorwa bya vuba'],
  ['No recent activity.', 'Aucune activité récente.', 'Nta gikorwa cya vuba.'],
  ['Users', 'Utilisateurs', 'Abakoresha'],
  ['Search users...', 'Rechercher des utilisateurs...', 'Shakisha abakoresha...'],
  ['All Roles', 'Tous les rôles', 'Inshingano zose'],
  ['Admins', 'Administrateurs', 'Abayobozi'],
  ['Name', 'Nom', 'Izina'],
  ['Email', 'E-mail', 'Imeri'],
  ['Role', 'Rôle', 'Inshingano'],
  ['Specialty', 'Spécialité', 'Inzobere'],
  ['Medical specialty', 'Spécialité médicale', 'Inzobere mu buvuzi'],
  ['Status', 'Statut', 'Imiterere'],
  ['Created', 'Créé le', 'Byakozwe'],
  ['Actions', 'Actions', 'Ibikorwa'],
  ['Active', 'Actif', 'Birakora'],
  ['Disabled', 'Désactivé', 'Ntibikora'],
  ['Enable', 'Activer', 'Kora'],
  ['Disable', 'Désactiver', 'Hagarika'],
  ['Save', 'Enregistrer', 'Bika'],
  ['Try again', 'Réessayer', 'Ongera ugerageze'],
  ['Previous', 'Précédent', 'Ibanjirije'],
  ['Next', 'Suivant', 'Ikurikira'],
  ['Page', 'Page', 'Paji'],
  ['of', 'sur', 'kuri'],
  ['users', 'utilisateurs', 'abakoresha'],
  ['No users match your search.', 'Aucun utilisateur ne correspond à votre recherche.', 'Nta mukoresha uhuye n’icyo washakishije.'],
  ['Create user', 'Créer un utilisateur', 'Fungura konti y’ukoresha'],
  ['Creating…', 'Création…', 'Birimo gukorwa...'],
  ['Temporary password', 'Mot de passe temporaire', 'Ijambo ry’ibanga ry’igihe gito'],

  ['Good morning,', 'Bonjour,', 'Mwaramutse,'],
  ['How are you feeling today?', 'Comment vous sentez-vous aujourd’hui ?', 'Uyu munsi urumva umeze ute?'],
  ['Talk to HealthMind AI', 'Parler à HealthMind AI', 'Ganira na HealthMind AI'],
  ['Ask AI', 'Demander à l’IA', 'Baza AI'],
  ['Book Appointment', 'Prendre rendez-vous', 'Saba gahunda kwa muganga'],
  ['View Records', 'Voir les dossiers', 'Reba inyandiko'],
  ['View all', 'Tout voir', 'Reba byose'],
  ['Health Overview', 'Aperçu de la santé', 'Incamake y’ubuzima'],
  ['Today', 'Aujourd’hui', 'Uyu munsi'],
  ['Upcoming Appointment', 'Prochain rendez-vous', 'Gahunda itaha kwa muganga'],
  ['Health Trends', 'Tendances de santé', 'Imihindagurikire y’ubuzima'],
  ['Last 7 days', '7 derniers jours', 'Iminsi 7 ishize'],
  ['Recent Medical Records', 'Dossiers médicaux récents', 'Inyandiko z’ubuvuzi za vuba'],
  ['Today’s Schedule', 'Planning du jour', 'Gahunda y’uyu munsi'],
  ["Today's Schedule", 'Planning du jour', 'Gahunda y’uyu munsi'],
  ['Recent Patients', 'Patients récents', 'Abarwayi ba vuba'],
  ['View All', 'Tout voir', 'Reba byose'],

  ['Book an Appointment', 'Prendre un rendez-vous', 'Saba gahunda kwa muganga'],
  ['Specialty', 'Spécialité', 'Inzobere'],
  ['Select specialty...', 'Sélectionnez une spécialité...', 'Hitamo inzobere...'],
  ['Select doctor...', 'Sélectionnez un médecin...', 'Hitamo muganga...'],
  ['Select time...', 'Sélectionnez une heure...', 'Hitamo isaha...'],
  ['Date', 'Date', 'Itariki'],
  ['Time', 'Heure', 'Isaha'],
  ['Notes', 'Notes', 'Ibisobanuro'],
  ['Confirm Booking', 'Confirmer le rendez-vous', 'Emeza gahunda'],
  ['All Status', 'Tous les statuts', 'Imiterere yose'],
  ['Upcoming', 'À venir', 'Ibizaza'],
  ['Completed', 'Terminé', 'Byarangiye'],
  ['Cancelled', 'Annulé', 'Byahagaritswe'],
  ['List', 'Liste', 'Urutonde'],
  ['Calendar', 'Calendrier', 'Kalendari'],
  ['From:', 'Du :', 'Kuva:'],
  ['To:', 'Au :', 'Kugeza:'],
  ['Apply', 'Appliquer', 'Emeza'],
  ['Export', 'Exporter', 'Ohereza hanze'],
  ['User Growth', 'Croissance des utilisateurs', 'Ubwiyongere bw’abakoresha'],
  ['Appointment Trends', 'Tendances des rendez-vous', 'Imihindagurikire ya gahunda'],
  ['User Role Distribution', 'Répartition des rôles utilisateurs', 'Ishingano z’abakoresha'],
  ['Medication Adherence', 'Observance des médicaments', 'Gufata imiti uko bikwiye'],

  ['Upload Record', 'Télécharger un dossier', 'Ohereza inyandiko'],
  ['All Records', 'Tous les dossiers', 'Inyandiko zose'],
  ['Medical History', 'Antécédents médicaux', 'Amateka y’ubuvuzi'],
  ['Lab Results', 'Résultats de laboratoire', 'Ibisubizo bya laboratwari'],
  ['Documents', 'Documents', 'Inyandiko'],
  ['All Types', 'Tous les types', 'Ubwoko bwose'],
  ['Document', 'Document', 'Inyandiko'],
  ['Upload Medical Record', 'Télécharger un dossier médical', 'Ohereza inyandiko y’ubuvuzi'],
  ['Record Type', 'Type de dossier', 'Ubwoko bw’inyandiko'],
  ['Select type...', 'Sélectionnez un type...', 'Hitamo ubwoko...'],
  ['Title', 'Titre', 'Umutwe'],
  ['File', 'Fichier', 'Idosiye'],
  ['Drag & drop your file here, or click to browse', 'Déposez votre fichier ici ou cliquez pour parcourir', 'Kurura dosiye uyishyire hano cyangwa ukande uhitemo'],
  ['Supported: PDF, JPG, PNG, DOC, DOCX (Max 10MB)', 'Formats acceptés : PDF, JPG, PNG, DOC, DOCX (10 Mo max.)', 'Byemewe: PDF, JPG, PNG, DOC, DOCX (ntibirenge 10MB)'],
  ['Upload', 'Télécharger', 'Ohereza'],
  ['Add Medication', 'Ajouter un médicament', 'Ongeraho umuti'],
  ['Medication Adherence', 'Observance des médicaments', 'Gufata imiti uko bikwiye'],
  ['Medication Name', 'Nom du médicament', 'Izina ry’umuti'],
  ['Dosage', 'Dosage', 'Ingano y’umuti'],
  ['Frequency', 'Fréquence', 'Inshuro'],
  ['Daily', 'Chaque jour', 'Buri munsi'],
  ['Twice Daily', 'Deux fois par jour', 'Kabiri ku munsi'],
  ['Three Times Daily', 'Trois fois par jour', 'Gatatu ku munsi'],
  ['Weekly', 'Chaque semaine', 'Buri cyumweru'],
  ['As Needed', 'Au besoin', 'Iyo bikenewe'],
  ['Instructions', 'Instructions', 'Amabwiriza'],
  ['Start Date', 'Date de début', 'Itariki yo gutangira'],
  ['End Date', 'Date de fin', 'Itariki yo kurangiza'],
  ['Mark All Read', 'Tout marquer comme lu', 'Shyira byose mu byasomwe'],
  ['Clear All', 'Tout effacer', 'Siba byose'],
  ['All', 'Tout', 'Byose'],
  ['Unread', 'Non lus', 'Bidasomwe'],
  ['System', 'Système', 'Sisitemu'],
  ['Personal Information', 'Informations personnelles', 'Amakuru bwite'],
  ['Save Changes', 'Enregistrer les modifications', 'Bika impinduka'],
  ['Change Password', 'Changer le mot de passe', 'Hindura ijambo ry’ibanga'],
  ['Update Password', 'Mettre à jour le mot de passe', 'Vugurura ijambo ry’ibanga'],
  ['Danger Zone', 'Zone dangereuse', 'Ahantu hakomeye'],
  ['Once you delete your account, there is no going back. Please be certain.', 'La suppression de votre compte est irréversible. Veuillez en être certain.', 'Iyo usibye konti yawe ntushobora kuyigarura. Banza ubyemeze neza.'],
  ['Delete Account', 'Supprimer le compte', 'Siba konti'],

  ['SOS', 'SOS', 'SOS'],
  ['Ready', 'Prêt', 'Witeguye'],
  ['Tap in Emergency', 'Appuyez en cas d’urgence', 'Kanda mu gihe cy’ubutabazi'],
  ['Emergency Contacts', 'Contacts d’urgence', 'Abantu bahamagarwa mu butabazi'],
  ['Emergency Services', 'Services d’urgence', 'Serivisi z’ubutabazi'],
  ['Emergency Alert', 'Alerte d’urgence', 'Ubutumwa bw’ubutabazi'],
  ['Trigger Emergency', 'Déclencher une alerte d’urgence', 'Ohereza ubutumwa bw’ubutabazi'],
  ['🚨 Trigger Emergency', '🚨 Déclencher une alerte d’urgence', '🚨 Ohereza ubutumwa bw’ubutabazi'],
  ['+ Add Contact', '+ Ajouter un contact', '+ Ongeraho umuntu wavugisha'],
  ['We’ve sent a password reset link to', 'Nous avons envoyé un lien de réinitialisation à', 'Twohereje umurongo wo guhindura ijambo ry’ibanga kuri'],
  ["We've sent a password reset link to", 'Nous avons envoyé un lien de réinitialisation à', 'Twohereje umurongo wo guhindura ijambo ry’ibanga kuri'],
  ['AI-powered healthcare guidance to help you understand, organize, and improve your health journey.', 'Des conseils de santé assistés par l’IA pour vous aider à comprendre, organiser et améliorer votre parcours de santé.', 'Inama z’ubuzima zikoreshwa na AI zigufasha gusobanukirwa, gutegura no kunoza urugendo rwawe rw’ubuzima.'],
  ['Built to Make Healthcare', 'Conçu pour rendre les soins de santé', 'Yakozwe kugira ngo ubuvuzi'],
  ['Understandable', 'compréhensibles', 'bwumvikane'],
  ['Proudly built to serve patients and providers across Rwanda and beyond.', 'Fièrement conçu pour servir les patients et les professionnels de santé au Rwanda et ailleurs.', 'Yakozwe mu kwita ku barwayi n’inzobere mu Rwanda no hanze yarwo.'],
  ['We’d Love to', 'Nous aimerions', 'Twifuza'],
  ["We'd Love to", 'Nous aimerions', 'Twifuza'],
  ['Hear From You', 'avoir de vos nouvelles', 'kumva ibitekerezo byawe'],
  ['Mon – Fri, 8:00 AM – 6:00 PM (CAT)', 'Lun – ven, 8 h – 18 h (CAT)', 'Kuwa mbere – kuwa gatanu, 8:00 – 18:00 (CAT)'],
  ['Kigali, Rwanda', 'Kigali, Rwanda', 'Kigali, u Rwanda'],
  ['Loading records...', 'Chargement des dossiers...', 'Inyandiko zirimo gupakira...'],
  ['User Name', 'Nom d’utilisateur', 'Izina ry’ukoresha'],
  ['Change the language used across the HealthMind AI app. Your choice is saved on this device.', 'Changez la langue utilisée dans toute l’application HealthMind AI. Votre choix est enregistré sur cet appareil.', 'Hindura ururimi rukoreshwa muri porogaramu ya HealthMind AI yose. Ururimi wahisemo rubikwa kuri iki gikoresho.'],
  ['"Based on your health profile, I notice you have an appointment coming up with Dr. Smith. Would you like me to prepare some questions for you?"', '« Selon votre profil de santé, vous avez bientôt un rendez-vous avec le Dr Smith. Voulez-vous que je prépare quelques questions ? »', '« Nkurikije amakuru yawe y’ubuzima, ufite gahunda kwa Dr. Smith vuba. Wifuza ko ngutegurira ibibazo? »'],
  ['Documents', 'Documents', 'Inyandiko'],
  ['Dosage', 'Dosage', 'Ingano y’umuti'],
  ['Instructions', 'Instructions', 'Amabwiriza'],
  ['About', 'À propos', 'Ibyerekeye'],
  ['Conversations', 'Conversations', 'Ibiganiro'],
  ['Notes', 'Notes', 'Ibisobanuro'],
  ['User', 'Utilisateur', 'Ukoresha porogaramu'],
  ['Contact', 'Contact', 'Twandikire'],
  ['Rwanda emergency services', 'Services d’urgence du Rwanda', 'Serivisi z’ubutabazi mu Rwanda'],
  ['Your Location', 'Votre emplacement', 'Aho uherereye'],
  ['Share Location', 'Partager l’emplacement', 'Sangiza aho uherereye'],
  ['Nearby Healthcare', 'Soins de santé à proximité', 'Ubuvuzi buri hafi'],
  ['Find Facilities', 'Trouver des établissements', 'Shakisha ibigo nderabuzima'],
  ['Emergency Instructions', 'Instructions d’urgence', 'Amabwiriza y’ubutabazi'],
  ['Stay calm and assess the situation', 'Restez calme et évaluez la situation', 'Tuza urebe uko ibintu bimeze'],
  ['If safe, contact your emergency contacts', 'Si vous pouvez le faire sans danger, contactez vos proches d’urgence', 'Niba ari nta kaga, hamagara abantu bagufasha mu butabazi'],
  ['Follow instructions from emergency services', 'Suivez les instructions des services d’urgence', 'Kurikiza amabwiriza ya serivisi z’ubutabazi'],
  ['Cancel', 'Annuler', 'Hagarika'],
  ['OK', 'OK', 'Yego'],
  ['← Back', '← Retour', '← Subira inyuma'],
  ['Share Location', 'Partager l’emplacement', 'Sangiza aho uherereye'],
  ['Save Preferences', 'Enregistrer les préférences', 'Bika ibyo wahisemo'],
  ['Appearance', 'Apparence', 'Imigaragarire'],
  ['Dark Mode', 'Mode sombre', 'Uburyo bwijimye'],
  ['Toggle between light and dark themes', 'Basculer entre les thèmes clair et sombre', 'Hindura hagati y’imigaragarire y’umucyo n’iyijimye'],
  ['Switch to Light Mode', 'Passer au mode clair', 'Hindura ku mucyo'],
  ['Switch to Dark Mode', 'Passer au mode sombre', 'Hindura ku mwijima'],
  ['Notification Preferences', 'Préférences de notification', 'Uko wakira ubutumwa'],
  ['Appointment reminders', 'Rappels de rendez-vous', 'Kwibutswa gahunda kwa muganga'],
  ['Medication reminders', 'Rappels de médicaments', 'Kwibutswa gufata imiti'],
  ['Health updates & tips', 'Actualités et conseils santé', 'Amakuru n’inama ku buzima'],
  ['Promotional offers', 'Offres promotionnelles', 'Amatangazo y’ibicuruzwa'],
  ['Account', 'Compte', 'Konti'],
  ['Edit Profile', 'Modifier le profil', 'Hindura umwirondoro'],
  ['About', 'À propos', 'Ibyerekeye'],
  ['Built with ❤️ for better healthcare', 'Conçu avec ❤️ pour de meilleurs soins de santé', 'Byakozwe ❤️ hagamijwe kunoza ubuvuzi'],
  ['Choose the preferred language for HealthMind AI. You can still ask in another language.', 'Choisissez la langue de HealthMind AI. Vous pouvez toujours poser vos questions dans une autre langue.', 'Hitamo ururimi rwa HealthMind AI. Ushobora gukomeza kubaza mu rundi rurimi.'],
  ['Assistant Language', 'Langue de l’assistant', 'Ururimi rw’umufasha'],
  ['App Language', 'Langue de l’application', 'Ururimi rwa porogaramu'],
  ['Language', 'Langue', 'Ururimi'],
  ['App Language', 'Langue de l’application', 'Ururimi rwa porogaramu'],
  ['English', 'Anglais', 'Icyongereza'],
  ['Français', 'Français', 'Igifaransa'],
  ['Kinyarwanda', 'Kinyarwanda', 'Ikinyarwanda'],
  ['French', 'Français', 'Igifaransa'],
  ['English', 'Anglais', 'Icyongereza'],
  ['Kinyarwanda', 'Kinyarwanda', 'Ikinyarwanda'],
  ['Save failed', 'Échec de l’enregistrement', 'Kubika byanze'],
  ['Saved', 'Enregistré', 'Byabitswe'],
  ['Could not save your language preference on this device.', 'Impossible d’enregistrer votre préférence linguistique sur cet appareil.', 'Ntibishobotse kubika ururimi wahisemo kuri iki gikoresho.'],
  ['Your language preference has been saved.', 'Votre préférence linguistique a été enregistrée.', 'Ururimi wahisemo rwabitswe.'],
  ['This language is not available.', 'Cette langue n’est pas disponible.', 'Urwo rurimi ntiruboneka.'],
  ['Online', 'En ligne', 'Ari kuri murandasi'],
  ['Conversations', 'Conversations', 'Ibiganiro'],
  ['New Chat', 'Nouvelle conversation', 'Ikiganiro gishya'],
  ['How can I help you today?', 'Comment puis-je vous aider aujourd’hui ?', 'Uyu munsi nagufasha nte?'],
  ['How can I help you today?', 'Comment puis-je vous aider aujourd’hui ?', 'Uyu munsi nagufasha nte?'],
  ['Ask me about your health, appointments, medications, or anything else.', 'Posez-moi des questions sur votre santé, vos rendez-vous, vos médicaments ou autre chose.', 'Mbaza ku buzima bwawe, gahunda kwa muganga, imiti cyangwa ikindi.'],
  ['Help me prepare for my appointment.', 'Aidez-moi à préparer mon rendez-vous.', 'Mfasha kwitegura gahunda kwa muganga.'],
  ['Show my upcoming appointments.', 'Afficher mes prochains rendez-vous.', 'Nyereka gahunda zanjye zitaha.'],
  ['Help me understand my lab report.', 'Aidez-moi à comprendre mon rapport de laboratoire.', 'Mfasha gusobanukirwa ibisubizo bya laboratwari.'],
  ['Remind me about my medication.', 'Rappelez-moi de prendre mon médicament.', 'Nyibutsa gufata umuti wanjye.'],
  ['Find a doctor near me.', 'Trouver un médecin près de chez moi.', 'Shakisha umuganga uri hafi yanjye.'],
  ['HealthMind AI provides informational support. Always consult your healthcare provider.', 'HealthMind AI fournit des informations générales. Consultez toujours votre professionnel de santé.', 'HealthMind AI itanga amakuru rusange. Buri gihe ujye ugisha inama inzobere mu buzima.'],
  ['AI Action Required', 'Action IA requise', 'Igikorwa cya AI kirakenewe'],
  ['Confirm', 'Confirmer', 'Emeza'],
  ['Send →', 'Envoyer →', 'Ohereza →'],
  ['Try AI Assistant →', 'Essayer l’assistant IA →', 'Gerageza umufasha wa AI →'],
  ['Get Started Free →', 'Commencer gratuitement →', 'Tangira ku buntu →'],
  ['Try AI Demo', 'Essayer la démo IA', 'Gerageza AI'],
  ['AI-Powered Healthcare', 'Soins de santé assistés par l’IA', 'Ubuvuzi bukoresha AI'],
  ['Your Health.', 'Votre santé.', 'Ubuzima bwawe.'],
  ['One Intelligent Assistant.', 'Un assistant intelligent.', 'Umufasha umwe w’ubwenge.'],
  ['Understand your health. Organize your care. Stay connected with AI-powered healthcare guidance.', 'Comprenez votre santé. Organisez vos soins. Restez accompagné grâce à des conseils de santé assistés par l’IA.', 'Sobanukirwa n’ubuzima bwawe. Tegura uko wivuza. Komeza gufashwa n’inama z’ubuzima zikoresha AI.'],
  ['Intelligent Healthcare,', 'Des soins intelligents,', 'Ubuvuzi bw’ubwenge,'],
  ['Simplified', 'Simplifiés', 'Bworoshye'],
  ['AI Health Assistant', 'Assistant santé IA', 'Umufasha w’ubuzima wa AI'],
  ['Organized Health Records', 'Dossiers de santé organisés', 'Inyandiko z’ubuzima ziteguye neza'],
  ['Smart Appointment Management', 'Gestion intelligente des rendez-vous', 'Gucunga gahunda kwa muganga mu buryo bworoshye'],
  ['Medication Reminders', 'Rappels de médicaments', 'Kwibutswa gufata imiti'],
  ['Real-time Notifications', 'Notifications en temps réel', 'Ubutumwa bw’ako kanya'],
  ['Secure & Private', 'Sécurisé et privé', 'Bitekanye kandi ni ibanga'],
  ['Create Your Account', 'Créez votre compte', 'Fungura konti yawe'],
  ['Connect Your Health Data', 'Connectez vos données de santé', 'Huza amakuru yawe y’ubuzima'],
  ['Let AI Guide You', 'Laissez l’IA vous guider', 'Reka AI ikuyobore'],
  ['Features', 'Fonctionnalités', 'Ibiranga porogaramu'],
  ['How can I help you with your health today?', 'Comment puis-je vous aider pour votre santé aujourd’hui ?', 'Uyu munsi nagufasha nte ku buzima bwawe?'],
  ['Intelligent Healthcare, Simplified', 'Des soins intelligents, simplifiés', 'Ubuvuzi bw’ubwenge kandi bworoshye'],
  ['HealthMind AI combines cutting-edge AI with compassionate care to help you take control of your health journey.', 'HealthMind AI associe une IA avancée à des soins bienveillants pour vous aider à prendre en main votre parcours de santé.', 'HealthMind AI ihuza ikoranabuhanga rigezweho n’ubwitange mu kukwitaho kugira ngo ugire uruhare mu rugendo rw’ubuzima bwawe.'],
  ['Get intelligent answers about your health, medications, appointments, and more — 24/7.', 'Obtenez des réponses intelligentes sur votre santé, vos médicaments, vos rendez-vous et bien plus, 24 h/24 et 7 j/7.', 'Bona ibisubizo bifasha ku buzima, imiti, gahunda kwa muganga n’ibindi igihe cyose.'],
  ['Keep all your medical records, lab results, and health history in one secure place.', 'Conservez vos dossiers médicaux, résultats de laboratoire et antécédents dans un espace sécurisé.', 'Bika inyandiko z’ubuvuzi, ibisubizo bya laboratwari n’amateka y’ubuzima ahantu hamwe hatekanye.'],
  ['Find, book, and manage appointments with healthcare providers effortlessly.', 'Trouvez, prenez et gérez facilement vos rendez-vous avec des professionnels de santé.', 'Shakisha, saba kandi ucunge gahunda kwa muganga mu buryo bworoshye.'],
  ['Never miss a dose with intelligent medication tracking and timely reminders.', 'Ne manquez aucune dose grâce au suivi intelligent des médicaments et aux rappels ponctuels.', 'Ntuzongere kwibagirwa umuti ukoresheje kwibutswa ku gihe.'],
  ['Stay informed about appointments, medication reminders, and health updates.', 'Restez informé des rendez-vous, des rappels de médicaments et des actualités santé.', 'Menya amakuru kuri gahunda kwa muganga, imiti n’ubuzima.'],
  ['Your health data is encrypted and protected with enterprise-grade security.', 'Vos données de santé sont chiffrées et protégées par une sécurité de niveau professionnel.', 'Amakuru yawe y’ubuzima ararinzwe kandi aratekanye.'],
  ['Three simple steps to smarter healthcare.', 'Trois étapes simples pour des soins plus intelligents.', 'Intambwe eshatu zoroshye zo kunoza ubuvuzi.'],
  ['Sign up for free and set up your health profile in minutes.', 'Inscrivez-vous gratuitement et créez votre profil santé en quelques minutes.', 'Iyandikishe ku buntu maze utegure umwirondoro w’ubuzima mu minota mike.'],
  ['Add your medical records, medications, and health information.', 'Ajoutez vos dossiers médicaux, médicaments et informations de santé.', 'Ongeraho inyandiko z’ubuvuzi, imiti n’amakuru y’ubuzima.'],
  ['Ask questions, get insights, and stay on top of your health journey.', 'Posez des questions, obtenez des conseils et suivez votre parcours de santé.', 'Baza ibibazo, ubone inama kandi ukurikirane ubuzima bwawe.'],
  ['Intelligent Health', 'Santé intelligente', 'Ubuzima bwubwenge'],
  ['Guidance', 'Conseils', 'Ubuyobozi'],
  ['HealthMind AI uses advanced language models to help you understand your health, prepare for appointments, and make informed decisions — while always encouraging professional medical care.', 'HealthMind AI utilise des modèles linguistiques avancés pour vous aider à comprendre votre santé, préparer vos rendez-vous et prendre des décisions éclairées, tout en encourageant toujours le recours à un professionnel de santé.', 'HealthMind AI ikoresha ikoranabuhanga ry’ubwenge rigufasha gusobanukirwa n’ubuzima, kwitegura gahunda kwa muganga no gufata ibyemezo, kandi igushishikariza kugisha inama inzobere mu buzima.'],
  ['HealthMind AI was created to close the gap between complex medical information and the people who need to understand it — pairing trustworthy AI guidance with straightforward tools for records, medications, and appointments, so managing your health feels less like paperwork and more like having a knowledgeable partner in your corner.', 'HealthMind AI a été créé pour rendre les informations médicales complexes compréhensibles, en associant des conseils IA fiables à des outils simples pour les dossiers, les médicaments et les rendez-vous.', 'HealthMind AI yakozwe kugira ngo amakuru akomeye y’ubuvuzi yumvikane, ihuza inama za AI zizewe n’ibikoresho byoroshye byo gucunga inyandiko, imiti na gahunda kwa muganga.'],
  ['AI-powered insight paired with real clinical judgment — we assist your care, never replace your doctor.', 'Des analyses assistées par l’IA associées à un véritable jugement clinique : nous accompagnons vos soins sans jamais remplacer votre médecin.', 'Inama za AI zihuzwa n’ubumenyi bw’inzobere mu buzima; tugufasha kwivuza ariko ntidusimbura muganga wawe.'],
  ['As someone managing multiple chronic conditions, having all my health information organized and accessible has been life-changing.', 'Avec plusieurs maladies chroniques à gérer, avoir toutes mes informations de santé organisées et accessibles a changé ma vie.', 'Kugira amakuru y’ubuzima bwanjye atondetse kandi aboneka byahinduye ubuzima bwanjye mu gihe ncunga indwara zidakira.'],
  ['The medication reminders have been a game-changer for my elderly mother. She’s never missed a dose since we started using HealthMind AI.', 'Les rappels de médicaments ont tout changé pour ma mère âgée. Elle n’a manqué aucune dose depuis que nous utilisons HealthMind AI.', 'Kwibutswa imiti byafashije cyane mama ugeze mu zabukuru. Ntiyongeye kwibagirwa umuti kuva dutangiye gukoresha HealthMind AI.'],
  ['The medication reminders have been a game-changer for my elderly mother. She\'s never missed a dose since we started using HealthMind AI.', 'Les rappels de médicaments ont tout changé pour ma mère âgée. Elle n’a manqué aucune dose depuis que nous utilisons HealthMind AI.', 'Kwibutswa imiti byafashije cyane mama ugeze mu zabukuru. Ntiyongeye kwibagirwa umuti kuva dutangiye gukoresha HealthMind AI.'],
  ['HealthMind AI helped me understand my lab results and prepare questions for my doctor. I felt so much more confident going into my appointment.', 'HealthMind AI m’a aidé à comprendre mes résultats et à préparer des questions pour mon médecin. J’étais beaucoup plus confiant lors de mon rendez-vous.', 'HealthMind AI yamfashije gusobanukirwa ibisubizo bya laboratwari no gutegura ibibazo nabaza muganga. Niyumvise nizeye cyane.'],
  ['HealthMind AI helped me understand my lab results and prepare questions for my doctor. I felt so much more confident going into my appointment.', 'HealthMind AI m’a aidé à comprendre mes résultats et à préparer des questions pour mon médecin. J’étais beaucoup plus confiant lors de mon rendez-vous.', 'HealthMind AI yamfashije gusobanukirwa ibisubizo bya laboratwari no gutegura ibibazo nabaza muganga. Niyumvise nizeye cyane.'],
  ['As someone managing multiple chronic conditions, having all my health information organized and accessible has been life-changing.', 'Avec plusieurs maladies chroniques à gérer, avoir toutes mes informations de santé organisées et accessibles a changé ma vie.', 'Kugira amakuru y’ubuzima bwanjye atondetse kandi aboneka byahinduye ubuzima bwanjye mu gihe ncunga indwara zidakira.'],
  ['Online', 'En ligne', 'Ari kuri murandasi'],
  ['Understand medical terminology in plain language', 'Comprendre les termes médicaux en langage simple', 'Sobanukirwa amagambo y’ubuvuzi mu rurimi rworoshye'],
  ['Prepare questions for your doctor visits', 'Préparer des questions pour vos consultations', 'Tegura ibibazo uzabaza muganga'],
  ['Track medications and health trends', 'Suivre les médicaments et les tendances de santé', 'Kurikirana imiti n’uko ubuzima buhinduka'],
  ['Get intelligent appointment recommendations', 'Recevoir des recommandations de rendez-vous pertinentes', 'Bona inama zifasha mu gutegura gahunda kwa muganga'],
  ['Your Health Data Is', 'Vos données de santé sont', 'Amakuru yawe y’ubuzima'],
  ['Protected', 'Protégées', 'Ararinzwe'],
  ['We take your privacy and security seriously. Your health information is encrypted and never shared without your explicit consent.', 'Nous prenons votre confidentialité et votre sécurité au sérieux. Vos informations de santé sont chiffrées et ne sont jamais partagées sans votre accord explicite.', 'Dufata ibanga n’umutekano wawe nk’iby’ingenzi. Amakuru y’ubuzima bwawe ntasangizwa abandi utabyemeye.'],
  ['End-to-End Encryption', 'Chiffrement de bout en bout', 'Kurinda amakuru kuva aho atangiriye kugeza aho ageze'],
  ['All data encrypted in transit and at rest.', 'Toutes les données sont chiffrées pendant le transfert et le stockage.', 'Amakuru yose ararinzwe igihe yoherezwa no igihe abitswe.'],
  ['HIPAA Compliant', 'Conforme à HIPAA', 'Yubahiriza HIPAA'],
  ['Meets healthcare privacy standards.', 'Respecte les normes de confidentialité des soins de santé.', 'Yubahiriza amabwiriza y’ibanga mu buvuzi.'],
  ['Your Data, Your Control', 'Vos données, votre contrôle', 'Amakuru yawe, uburenganzira ni ubwawe'],
  ['Full control over who can access your information.', 'Vous contrôlez entièrement qui peut accéder à vos informations.', 'Ni wowe ugenzura abafite uburenganzira bwo kubona amakuru yawe.'],
  ['Audit Logs', 'Journaux d’audit', 'Inyandiko z’igenzura'],
  ['Complete visibility into data access.', 'Visibilité complète sur l’accès aux données.', 'Reba neza uko amakuru agerwaho.'],
  ['Built to Make Healthcare Understandable', 'Conçu pour rendre les soins compréhensibles', 'Yakozwe kugira ngo ubuvuzi bwumvikane'],
  ['Our Mission', 'Notre mission', 'Intego yacu'],
  ['Make quality health guidance accessible to everyone, everywhere.', 'Rendre des conseils de santé de qualité accessibles à tous, partout.', 'Guha buri wese aho ari hose inama nziza ku buzima.'],
  ['Our Approach', 'Notre approche', 'Uburyo dukoresha'],
  ['Our Reach', 'Notre portée', 'Aho dukorera'],
  ['Questions about your account, a partnership idea, or feedback on the product — reach out and our team will get back to you.', 'Une question sur votre compte, une idée de partenariat ou un commentaire ? Contactez-nous et notre équipe vous répondra.', 'Niba ufite ikibazo kuri konti, igitekerezo cy’ubufatanye cyangwa igitekerezo ku bicuruzwa, twandikire tuzagusubiza.'],
  ['Email Us', 'Envoyez-nous un e-mail', 'Twoherereze imeri'],
  ['Support Hours', 'Heures d’assistance', 'Amasaha y’ubufasha'],
  ['Location', 'Emplacement', 'Aho duherereye'],
  ['What Our Users Say', 'Ce que disent nos utilisateurs', 'Ibyo abakoresha bavuga'],
  ['Real stories from people who have improved their health journey.', 'Des témoignages de personnes qui ont amélioré leur parcours de santé.', 'Inkuru z’abantu bateye imbere mu rugendo rw’ubuzima.'],
  ['Ready to Take Control of Your Health?', 'Prêt à prendre en main votre santé ?', 'Witeguye kugira uruhare mu buzima bwawe?'],
  ['Join thousands of users who trust HealthMind AI to help them stay on top of their health.', 'Rejoignez des milliers d’utilisateurs qui font confiance à HealthMind AI pour suivre leur santé.', 'Fatanya n’ibihumbi by’abantu bifashisha HealthMind AI mu gukurikirana ubuzima bwabo.'],
  ['Product', 'Produit', 'Ibicuruzwa'],
  ['Pricing', 'Tarifs', 'Ibiciro'],
  ['Company', 'Entreprise', 'Ikigo'],
  ['Careers', 'Carrières', 'Imirimo'],
  ['Blog', 'Blog', 'Blog'],
  ['Help Center', 'Centre d’aide', 'Ahagenewe ubufasha'],
  ['© 2026 HealthMind AI. All rights reserved.', '© 2026 HealthMind AI. Tous droits réservés.', '© 2026 HealthMind AI. Uburenganzira bwose burabitswe.'],
  ['Healthcare Made Smarter', 'Des soins de santé plus intelligents', 'Ubuvuzi burushijeho kuba ubwenge'],
  ['HealthMind AI — Healthcare Made Smarter', 'HealthMind AI — Des soins de santé plus intelligents', 'HealthMind AI — Ubuvuzi burushijeho kuba ubwenge'],
  ['Admin Dashboard — HealthMind AI', 'Tableau de bord administrateur — HealthMind AI', 'Paji mbuga y’umuyobozi — HealthMind AI'],
  ['Analytics — HealthMind AI Admin', 'Statistiques — Administration HealthMind AI', 'Imibare — Ubuyobozi bwa HealthMind AI'],
  ['Appointments — HealthMind AI', 'Rendez-vous — HealthMind AI', 'Gahunda kwa muganga — HealthMind AI'],
  ['Dashboard — HealthMind AI', 'Tableau de bord — HealthMind AI', 'Paji mbuga — HealthMind AI'],
  ['Doctor Dashboard — HealthMind AI', 'Tableau de bord médecin — HealthMind AI', 'Paji mbuga ya muganga — HealthMind AI'],
  ['Emergency — HealthMind AI', 'Urgence — HealthMind AI', 'Ubutabazi bwihuse — HealthMind AI'],
  ['Login — HealthMind AI', 'Connexion — HealthMind AI', 'Kwinjira — HealthMind AI'],
  ['Medical Records — HealthMind AI', 'Dossiers médicaux — HealthMind AI', 'Inyandiko z’ubuvuzi — HealthMind AI'],
  ['Medications — HealthMind AI', 'Médicaments — HealthMind AI', 'Imiti — HealthMind AI'],
  ['Notifications — HealthMind AI', 'Notifications — HealthMind AI', 'Ubutumwa — HealthMind AI'],
  ['Profile — HealthMind AI', 'Profil — HealthMind AI', 'Umwirondoro — HealthMind AI'],
  ['Settings — HealthMind AI', 'Paramètres — HealthMind AI', 'Igenamiterere — HealthMind AI'],
  ['Users — HealthMind AI Admin', 'Utilisateurs — Administration HealthMind AI', 'Abakoresha — Ubuyobozi bwa HealthMind AI'],
  ['Patients — HealthMind AI', 'Patients — HealthMind AI', 'Abarwayi — HealthMind AI'],
  ['Create Account — HealthMind AI', 'Créer un compte — HealthMind AI', 'Fungura konti — HealthMind AI'],
  ['Reset Password — HealthMind AI', 'Réinitialiser le mot de passe — HealthMind AI', 'Hindura ijambo ry’ibanga — HealthMind AI'],
  ['Free to use', 'Gratuit', 'Ni ubuntu'],
  ['Secure & private', 'Sécurisé et privé', 'Bitekanye kandi ni ibanga'],
  ['HIPAA compliant', 'Conforme à HIPAA', 'Yubahiriza HIPAA'],
  ['Help me with my medication', 'Aidez-moi avec mes médicaments', 'Mfasha ku bijyanye n’imiti yanjye'],
  ['Find a doctor near me', 'Trouver un médecin près de chez moi', 'Shakisha umuganga uri hafi yanjye'],
  ['Explain my lab results', 'Expliquez mes résultats de laboratoire', 'Nsobanurira ibisubizo bya laboratwari'],
  ['Track my health trends', 'Suivre l’évolution de ma santé', 'Kurikirana uko ubuzima bwanjye buhinduka'],
  ['Prepare questions', 'Préparer des questions', 'Tegura ibibazo'],
  ['Review appointment', 'Consulter le rendez-vous', 'Reba gahunda'],
  ['Check medications', 'Vérifier les médicaments', 'Reba imiti'],
  ['Send', 'Envoyer', 'Ohereza'],
  ['Email Us', 'Envoyez-nous un e-mail', 'Twoherereze imeri'],
  ['Patient', 'Patient', 'Umurwayi'],
  ['Caregiver', 'Aidant', 'Umwitaho'],
  ['How can I help you today?', 'Comment puis-je vous aider aujourd’hui ?', 'Uyu munsi nagufasha nte?'],
  ['Search...', 'Rechercher...', 'Shakisha...'],
  ['Search doctors...', 'Rechercher des médecins...', 'Shakisha abaganga...'],
  ['Search patients...', 'Rechercher des patients...', 'Shakisha abarwayi...'],
  ['Search records...', 'Rechercher des dossiers...', 'Shakisha inyandiko...'],
  ['No appointments found.', 'Aucun rendez-vous trouvé.', 'Nta gahunda zabonetse.'],
  ['No medications found.', 'Aucun médicament trouvé.', 'Nta miti yabonetse.'],
  ['No notifications found.', 'Aucune notification trouvée.', 'Nta butumwa bwabonetse.'],
  ['No records found.', 'Aucun dossier trouvé.', 'Nta nyandiko zabonetse.'],
  ['No patients found.', 'Aucun patient trouvé.', 'Nta murwayi wabonetse.'],
  ['No doctors found.', 'Aucun médecin trouvé.', 'Nta muganga wabonetse.'],
  ['Failed to load data.', 'Échec du chargement des données.', 'Gupakira amakuru byanze.'],
  ['Something went wrong. Please try again.', 'Une erreur s’est produite. Veuillez réessayer.', 'Hari ikibazo kibaye. Ongera ugerageze.'],
  ['Saved successfully.', 'Enregistré avec succès.', 'Byabitswe neza.'],
  ['Saved', 'Enregistré', 'Byabitswe'],
  ['Changes saved successfully.', 'Modifications enregistrées avec succès.', 'Impinduka zabitswe neza.'],
  ['Could not save your changes. Please try again.', 'Impossible d’enregistrer vos modifications. Veuillez réessayer.', 'Ntibyashobotse kubika impinduka. Ongera ugerageze.'],
  ['Appointment reminders', 'Rappels de rendez-vous', 'Kwibutswa gahunda kwa muganga'],
  ['Medication reminders', 'Rappels de médicaments', 'Kwibutswa gufata imiti'],
  ['Share your location', 'Partager votre emplacement', 'Sangiza aho uherereye'],
  ['Stay calm and assess the situation', 'Restez calme et évaluez la situation', 'Tuza urebe uko ibintu bimeze'],
  ['Call Rwanda emergency services on 112, or your local emergency number', 'Appelez les services d’urgence du Rwanda au 112 ou le numéro d’urgence local', 'Hamagara ubutabazi mu Rwanda kuri 112 cyangwa nimero y’ubutabazi yo mu gace urimo'],
  ['Only use this button in a genuine medical emergency.', 'N’utilisez ce bouton qu’en cas de véritable urgence médicale.', 'Koresha iyi buto gusa mu gihe cy’ubutabazi bwihutirwa.'],
  ['Are you sure you want to trigger an emergency alert?', 'Voulez-vous vraiment déclencher une alerte d’urgence ?', 'Urashaka koko kohereza ubutumwa bw’ubutabazi?'],
  ['This sends an email alert to the configured HealthMind contact. It does not contact emergency responders. Call 112 now for urgent help.', 'Cela envoie une alerte par e-mail au contact HealthMind configuré. Cela ne contacte pas les services d’urgence. Appelez le 112 en cas d’urgence.', 'Ibi byohereza imeri ku muntu wa HealthMind wagenwe. Ntibihamagara ubutabazi. Hamagara 112 niba ukeneye ubufasha bwihuse.'],
  ['Emergency Alert Sent', 'Alerte d’urgence envoyée', 'Ubutumwa bw’ubutabazi bwoherejwe'],
  ['The emergency email alert was sent.', 'L’alerte d’urgence par e-mail a été envoyée.', 'Ubutumwa bw’ubutabazi bwoherejwe kuri imeri.'],
  ['This app does not contact emergency responders. Call Rwanda emergency services on 112 now if you need urgent help.', 'Cette application ne contacte pas les services d’urgence. Appelez le 112 au Rwanda si vous avez besoin d’aide immédiate.', 'Iyi porogaramu ntihamagara ubutabazi. Hamagara 112 mu Rwanda niba ukeneye ubufasha bwihuse.'],
  ['Location services are being accessed...', 'Accès aux services de localisation...', 'Turimo kugerageza kumenya aho uherereye...'],
  ['Searching for nearby facilities...', 'Recherche d’établissements à proximité...', 'Turimo gushakisha ibigo nderabuzima biri hafi...'],
  ['Stay calm and assess the situation', 'Restez calme et évaluez la situation', 'Tuza urebe uko ibintu bimeze'],
  ['Try Again', 'Réessayer', 'Ongera ugerageze'],
  ['Save Preferences', 'Enregistrer les préférences', 'Bika ibyo wahisemo'],
  ['Notification preferences saved on this device.', 'Préférences de notification enregistrées sur cet appareil.', 'Uko wakira ubutumwa kwabitswe kuri iki gikoresho.'],
  ['Preferences saved', 'Préférences enregistrées', 'Ibyahiswemo byabitswe'],
  ['Assistant language saved', 'Langue de l’assistant enregistrée', 'Ururimi rw’umufasha rwabitswe'],
  ['Set a New Password', 'Définir un nouveau mot de passe', 'Shyiraho ijambo ry’ibanga rishya'],
  ['Enter your new password below', 'Saisissez votre nouveau mot de passe ci-dessous', 'Andika ijambo ry’ibanga rishya hepfo'],
  ['Password Updated', 'Mot de passe mis à jour', 'Ijambo ry’ibanga rivuguruwe'],
  ['Your password has been reset successfully. You can now log in with your new password.', 'Votre mot de passe a été réinitialisé. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.', 'Ijambo ry’ibanga ryawe ryahinduwe neza. Ushobora kwinjira ukoresheje irishya.'],
  ['Go to Log In', 'Aller à la connexion', 'Jya ku kwinjira'],
  ['Failed to load dashboard data.', 'Échec du chargement des données du tableau de bord.', 'Gupakira amakuru ya paji mbuga byanze.'],
  ['No health data available yet.', 'Aucune donnée de santé disponible pour le moment.', 'Nta makuru y’ubuzima arahari.'],
  ['Connect your health devices or add your health information in settings.', 'Connectez vos appareils de santé ou ajoutez vos informations dans les paramètres.', 'Huza ibikoresho by’ubuzima cyangwa wongere amakuru yawe mu igenamiterere.'],
  ['Heart Rate', 'Fréquence cardiaque', 'Umuvuduko w’umutima'],
  ['Blood Pressure', 'Tension artérielle', 'Umuvuduko w’amaraso'],
  ['Steps', 'Pas', 'Intambwe'],
  ['Sleep', 'Sommeil', 'Ibitotsi'],
  ['No upcoming appointments', 'Aucun rendez-vous à venir', 'Nta gahunda iri imbere'],
  ['No medications added', 'Aucun médicament ajouté', 'Nta muti wongeyeho'],
  ['No appointments scheduled for today.', 'Aucun rendez-vous prévu aujourd’hui.', 'Nta gahunda ziteganyijwe uyu munsi.'],
  ['General checkup', 'Consultation générale', 'Isuzuma rusange'],
  ['Time TBD', 'Heure à confirmer', 'Isaha izamenyekana'],
  ['Location TBD', 'Lieu à confirmer', 'Aho bizabera hazamenyekana'],
  ['No notifications', 'Aucune notification', 'Nta butumwa'],
  ["You're all caught up!", 'Vous êtes à jour !', 'Nta butumwa bushya ufite!'],
  ['No notifications in this category.', 'Aucune notification dans cette catégorie.', 'Nta butumwa muri iki cyiciro.'],
  ['Mark as read', 'Marquer comme lu', 'Shyira mu byasomwe'],
  ['Delete', 'Supprimer', 'Siba'],
  ['Are you sure you want to cancel this appointment?', 'Voulez-vous vraiment annuler ce rendez-vous ?', 'Urashaka koko guhagarika iyi gahunda?'],
  ['Delete this notification?', 'Supprimer cette notification ?', 'Urashaka gusiba ubu butumwa?'],
  ['No records found', 'Aucun dossier trouvé', 'Nta nyandiko zabonetse'],
  ['Upload a medical record to get started.', 'Téléchargez un dossier médical pour commencer.', 'Ohereza inyandiko y’ubuvuzi kugira ngo utangire.'],
  ['Prescription', 'Ordonnance', 'Urupapuro rwa muganga'],
  ['Imaging', 'Imagerie', 'Ibizamini by’amashusho'],
  ['Vaccination', 'Vaccination', 'Urukingo'],
  ['General', 'Général', 'Rusange'],
  ['Doctor', 'Médecin', 'Muganga'],
  ['Patient', 'Patient', 'Umurwayi'],
  ['Time TBD', 'Heure à confirmer', 'Isaha izamenyekana'],
  ['TBD', 'À confirmer', 'Bizamenyekana'],
  ['30 min', '30 min', 'Iminota 30'],
  ['No recent activity.', 'Aucune activité récente.', 'Nta gikorwa cya vuba.'],
  ['Just now', 'À l’instant', 'Ubu'],
  ['Recent', 'Récent', 'Vuba'],
  ['Information', 'Information', 'Amakuru'],
  ['Required', 'Obligatoire', 'Birakenewe'],
  ['Support', 'Assistance', 'Ubufasha'],
  ['Help Center', 'Centre d’aide', 'Ahagenewe ubufasha'],
  ['Accessibility', 'Accessibilité', 'Korohereza abantu bose'],
  ['Privacy Policy', 'Politique de confidentialité', 'Politiki y’ibanga'],
  ['Terms of Service', 'Conditions d’utilisation', 'Amabwiriza yo gukoresha'],
  ['HealthMind AI v1.0.0', 'HealthMind AI v1.0.0', 'HealthMind AI v1.0.0'],
];

const normalize = (value) => value
  .replace(/\s+/g, ' ')
  .replace(/[\u200D\uFE0E\uFE0F]/g, '')
  .trim()
  .replace(/^\u2139\s*/u, '')
  .replace(/^[^\p{L}\p{N}]+/u, '')
  .replace(/[^\p{L}\p{N})!?%:]+$/u, '')
  .toLocaleLowerCase('en');

const translationByKey = { fr: new Map(), rw: new Map() };
for (const [english, french, kinyarwanda] of entries) {
  translationByKey.fr.set(normalize(english), french);
  translationByKey.rw.set(normalize(english), kinyarwanda);
}

const textOriginals = new WeakMap();
const attributeOriginals = new WeakMap();
let activeLanguage = DEFAULT_LANGUAGE;
let observer = null;
let initialized = false;
let originalDocumentTitle = '';

const supportedLanguages = ['en', 'fr', 'rw'];
const localeByLanguage = { en: 'en-US', fr: 'fr-FR', rw: 'rw-RW' };

const getLanguage = () => activeLanguage;
const getLocale = () => localeByLanguage[activeLanguage] || localeByLanguage.en;
const formatDate = (value, options) => {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(getLocale(), options).format(date);
};
const formatTime = (value, options = { hour: '2-digit', minute: '2-digit' }) => {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(getLocale(), options).format(date);
};
const formatMonth = (value, options = { month: 'long', year: 'numeric' }) => {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(getLocale(), options).format(date);
};

const translateText = (source, language = activeLanguage) => {
  if (language === DEFAULT_LANGUAGE || !translationByKey[language]) return source;
  const key = normalize(source);
  const translation = translationByKey[language].get(key) || translateRelativeTime(key, language);
  if (translation) {
    const leading = source.match(/^(?:\s|[\p{Extended_Pictographic}\u2139\uFE0E\uFE0F\u200D])+/u)?.[0] || '';
    const trailing = source.match(/\s*$/)?.[0] || '';
    return `${leading}${translation}${trailing}`;
  }
  return source;
};

const translateRelativeTime = (text, language) => {
  const match = text.match(/^(\d+)\s*([mhd]) ago$/);
  if (!match) return '';
  const [, amount, unit] = match;
  if (language === 'fr') {
    const units = { m: 'min', h: 'h', d: 'j' };
    return `Il y a ${amount} ${units[unit]}`;
  }
  const units = { m: 'iminota', h: 'amasaha', d: 'iminsi' };
  return `Hashize ${units[unit]} ${amount}`;
};

const translateTextNode = (node) => {
  const current = node.nodeValue || '';
  let record = textOriginals.get(node);
  if (record && current !== record.rendered) {
    record.source = current;
  } else if (!record) {
    record = { source: current, rendered: current };
    textOriginals.set(node, record);
  }

  const translated = translateText(record.source);
  if (translated !== current) node.nodeValue = translated;
  record.rendered = translated;
};

const translateAttributes = (element) => {
  const attributes = ['placeholder', 'title', 'aria-label', 'alt'];
  let records = attributeOriginals.get(element);
  if (!records) {
    records = new Map();
    attributeOriginals.set(element, records);
  }

  for (const name of attributes) {
    if (!element.hasAttribute(name)) continue;
    const current = element.getAttribute(name) || '';
    let record = records.get(name);
    if (record && current !== record.rendered) {
      record.source = current;
    } else if (!record) {
      record = { source: current, rendered: current };
      records.set(name, record);
    }

    const translated = translateText(record.source);
    if (translated !== current) element.setAttribute(name, translated);
    record.rendered = translated;
  }
};

const translateSubtree = (root) => {
  if (!root || !globalThis.Node) return;
  if (root.nodeType === Node.TEXT_NODE) {
    const parent = root.parentElement;
    if (parent && !parent.closest('script, style, noscript, textarea, code, [contenteditable="true"]')) {
      translateTextNode(root);
    }
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root !== document) return;

  if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root);
  const elementWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  while (elementWalker.nextNode()) translateAttributes(elementWalker.currentNode);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.parentElement?.closest('script, style, noscript, textarea, code, [contenteditable="true"]')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    },
  });
  while (walker.nextNode()) translateTextNode(walker.currentNode);

  if (root === document || root === document.documentElement || root === document.body) {
    document.documentElement.lang = activeLanguage;
    const sourceTitle = originalDocumentTitle || document.title;
    const directTitle = translateText(sourceTitle);
    if (directTitle !== sourceTitle) {
      document.title = directTitle;
    } else {
      const [pageTitle, ...suffix] = sourceTitle.split(' — ');
      document.title = suffix.length
        ? `${translateText(pageTitle)} — ${suffix.join(' — ')}`
        : sourceTitle;
    }
  }
};

const syncSelectors = () => {
  document.querySelectorAll('[data-app-language]').forEach((select) => {
    select.value = activeLanguage;
  });
};

const setLanguage = (language) => {
  if (!supportedLanguages.includes(language)) {
    throw new Error('This language is not available.');
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LANGUAGE_KEY, language);
  }
  activeLanguage = language;
  translateSubtree(document.documentElement);
  syncSelectors();
  document.dispatchEvent(new CustomEvent('healthmind:languagechange', {
    detail: { language },
  }));
  return activeLanguage;
};

const createLanguageSelector = () => {
  if (document.querySelector('[data-app-language]')) return;
  const host = document.querySelector('.page-header-actions, .public-actions')
    || document.querySelector('.app-container > div');
  if (!host) return;

  const label = document.createElement('label');
  label.className = 'app-language-control';
  label.setAttribute('data-i18n-control', 'language');
  const text = document.createElement('span');
  text.textContent = 'Language';
  const select = document.createElement('select');
  select.className = 'input-field app-language-select';
  select.setAttribute('aria-label', 'Language');
  select.setAttribute('data-app-language', '');
  [
    ['en', 'English'],
    ['fr', 'Français'],
    ['rw', 'Kinyarwanda'],
  ].forEach(([value, name]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = name;
    select.appendChild(option);
  });
  select.value = activeLanguage;
  label.append(text, select);
  const themeToggle = host.querySelector('.theme-toggle');
  host.insertBefore(label, themeToggle || null);
};

const init = () => {
  if (initialized || typeof document === 'undefined') return;
  initialized = true;
  try {
    const stored = localStorage.getItem(LANGUAGE_KEY);
    activeLanguage = supportedLanguages.includes(stored) ? stored : DEFAULT_LANGUAGE;
  } catch (error) {
    console.error('Failed to read saved app language:', error);
    activeLanguage = DEFAULT_LANGUAGE;
  }

  originalDocumentTitle = document.title;
  createLanguageSelector();
  translateSubtree(document.documentElement);
  syncSelectors();
  document.querySelectorAll('[data-app-language]:not(#language-select)').forEach((select) => {
    select.addEventListener('change', () => {
      try {
        setLanguage(select.value);
      } catch (error) {
        console.error('Failed to change app language:', error);
        syncSelectors();
        document.dispatchEvent(new CustomEvent('healthmind:languageerror', { detail: { error } }));
      }
    });
  });

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => translateSubtree(node));
      } else if (mutation.type === 'attributes') {
        translateAttributes(mutation.target);
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['placeholder', 'title', 'aria-label', 'alt'],
  });

  window.addEventListener('storage', (event) => {
    if (event.key !== LANGUAGE_KEY || !supportedLanguages.includes(event.newValue)) return;
    activeLanguage = event.newValue;
    translateSubtree(document.documentElement);
    syncSelectors();
    document.dispatchEvent(new CustomEvent('healthmind:languagechange', {
      detail: { language: activeLanguage },
    }));
  });
};

export {
  DEFAULT_LANGUAGE,
  LANGUAGE_KEY,
  formatDate,
  formatMonth,
  formatTime,
  getLanguage,
  getLocale,
  init,
  setLanguage,
  supportedLanguages,
  translateText,
};

export default {
  DEFAULT_LANGUAGE,
  LANGUAGE_KEY,
  formatDate,
  formatMonth,
  formatTime,
  getLanguage,
  getLocale,
  init,
  setLanguage,
  supportedLanguages,
  translateText,
};
