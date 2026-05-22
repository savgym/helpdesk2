import sgMail from "@sendgrid/mail";

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export async function sendReply({
  to,
  toName,
  subject,
  body,
}: {
  to: string;
  toName: string;
  subject: string;
  body: string;
}) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;

  if (!apiKey || !from) return;

  const reSubject = subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`;

  await sgMail.send({
    to: { email: to, name: toName },
    from,
    subject: reSubject,
    text: body,
  });
}
