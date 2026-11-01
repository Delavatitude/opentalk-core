export const bookingTypeHelp = {
  contexts: {
    fr: "Classez ce type de rendez-vous dans les contextes qui correspondent à votre activité. Gardez Général pour un usage courant. Dans Ma page, sélectionnez ensuite les types de rendez-vous à proposer aux visiteurs.",
    en: "Group this appointment type into the contexts that match your business. Keep General for everyday use. Under My page, then select the appointment types visitors can book."
  },
  reminder_24h: {
    fr: "Prévoit un email de rappel environ 24 heures avant le rendez-vous. Réglage global reprend le choix défini dans Notifications ; Activé ou Désactivé le remplace pour ce type uniquement. L’envoi nécessite des emails configurés et des rappels automatiques actifs. Un rendez-vous pris moins de 24 heures avant ne reçoit pas ce rappel.",
    en: "Schedules an email reminder about 24 hours before the appointment. Global setting follows Notifications; Enabled or Disabled overrides it for this type only. Sending requires configured email and automatic reminders. Appointments booked less than 24 hours ahead do not receive this reminder."
  },
  reminder_1h: {
    fr: "Prévoit un email de rappel environ 1 heure avant le rendez-vous. Réglage global reprend le choix défini dans Notifications ; Activé ou Désactivé le remplace pour ce type uniquement. L’envoi nécessite des emails configurés et des rappels automatiques actifs. Un rendez-vous pris moins d’une heure avant ne reçoit pas ce rappel.",
    en: "Schedules an email reminder about 1 hour before the appointment. Global setting follows Notifications; Enabled or Disabled overrides it for this type only. Sending requires configured email and automatic reminders. Appointments booked less than an hour ahead do not receive this reminder."
  },
  name_en_label: {
    fr: "Nom présenté aux visiteurs anglophones, par exemple Discovery call. Renseignez au moins un nom, en français ou en anglais, pour pouvoir enregistrer ce type.",
    en: "Name shown to English-speaking visitors, for example Discovery call. Enter at least one name, in English or French, to save this type."
  },
  name_fr_label: {
    fr: "Nom présenté aux visiteurs francophones, par exemple Appel découverte. Utilisez un intitulé court qui explique clairement l’objet du rendez-vous.",
    en: "Name shown to French-speaking visitors, for example Appel découverte. Use a short title that clearly describes the appointment."
  },
  desc_en_label: {
    fr: "Description en anglais destinée aux visiteurs. Précisez à qui s’adresse ce rendez-vous, son objectif et ce qu’il faut préparer. Ce champ est facultatif.",
    en: "English description for visitors. Explain who this appointment is for, its purpose and what to prepare. This field is optional."
  },
  desc_fr_label: {
    fr: "Description en français destinée aux visiteurs. Précisez à qui s’adresse ce rendez-vous, son objectif et ce qu’il faut préparer. Ce champ est facultatif.",
    en: "French description for visitors. Explain who this appointment is for, its purpose and what to prepare. This field is optional."
  },
  slug: {
    fr: "Identifiant court de ce type, par exemple appel-decouverte. Utilisez des lettres minuscules, des chiffres et des tirets. Laissez vide pour le générer depuis le nom au moment de l’enregistrement.",
    en: "Short identifier for this type, for example discovery-call. Use lowercase letters, numbers and hyphens. Leave it empty to generate it from the name when saving."
  },
  duration_min_label: {
    fr: "Temps du rendez-vous en minutes : 30 signifie une demi-heure. Les créneaux proposés doivent pouvoir accueillir cette durée dans vos horaires disponibles.",
    en: "Appointment length in minutes: 30 means half an hour. Offered slots must fit this duration within your available hours."
  },
  brand_context: {
    fr: "Étiquette facultative pour repérer ce type dans votre administration, par exemple Conseil ou Formation. Elle ne remplace pas le nom affiché aux visiteurs.",
    en: "Optional label to identify this type in your administration, for example Consulting or Training. It does not replace the name shown to visitors."
  },
  buffer_before: {
    fr: "Temps de préparation réservé avant chaque rendez-vous. Par exemple, 10 bloque les 10 minutes qui précèdent le début. Mettez 0 si vous n’avez pas besoin de préparation.",
    en: "Preparation time reserved before each appointment. For example, 10 blocks the 10 minutes before it starts. Enter 0 if no preparation time is needed."
  },
  buffer_after: {
    fr: "Temps réservé après chaque rendez-vous pour vos notes ou une pause. Par exemple, 15 protège les 15 minutes suivant la fin. Mettez 0 pour ne pas ajouter de pause.",
    en: "Time reserved after each appointment for notes or a break. For example, 15 protects the 15 minutes after it ends. Enter 0 for no extra break."
  },
  min_notice: {
    fr: "Délai minimum entre la réservation et le début du rendez-vous. Par exemple, 180 impose de réserver au moins 3 heures à l’avance. Mettez 0 pour accepter les réservations de dernière minute.",
    en: "Minimum time between booking and the appointment start. For example, 180 requires booking at least 3 hours ahead. Enter 0 to accept last-minute bookings."
  },
  max_per_day: {
    fr: "Plafond quotidien utilisé pour proposer les créneaux de ce type. Par exemple, 8 masque les créneaux supplémentaires lorsque 8 rendez-vous actifs occupent déjà la journée, selon le fuseau de référence.",
    en: "Daily limit used when offering slots for this type. For example, 8 hides extra slots once 8 active appointments already occupy the day in your reference timezone."
  },
  booking_window: {
    fr: "Nombre de jours à l’avance pendant lesquels les visiteurs peuvent réserver. Par exemple, 30 ouvre les disponibilités sur les 30 prochains jours, sous réserve de vos horaires et périodes bloquées.",
    en: "How many days ahead visitors can book. For example, 30 opens availability for the next 30 days, subject to working hours and blocked periods."
  },
  sort_order: {
    fr: "Position relative dans la liste des types. Les nombres les plus petits apparaissent d’abord : utilisez par exemple 0, 10 et 20 pour pouvoir insérer un type entre deux autres.",
    en: "Relative position in the type list. Lower numbers appear first: use 0, 10 and 20 to leave room to insert another type between them."
  },
  location_type: {
    fr: "Choisissez comment se déroule le rendez-vous : téléphone, lieu physique ou lien personnalisé. Dans cette version, aucun lien Google Meet n’est créé automatiquement ; utilisez un lien de visioconférence existant avec Lieu personnalisé.",
    en: "Choose how the appointment takes place: phone, physical location or custom link. This version does not create Google Meet links automatically; use an existing video meeting link with Custom location."
  },
  location_value: {
    fr: "Indiquez le numéro de téléphone, l’adresse physique ou le lien de visioconférence selon le lieu choisi. Cette information est communiquée dans les détails du rendez-vous : vérifiez qu’elle est correcte avant d’enregistrer.",
    en: "Enter the phone number, physical address or video meeting link for the chosen location. This information is shared in appointment details: check it before saving."
  }
};
