import prisma from "../lib/prisma";

const TICKET_ID = 39;

const messages: { body: string; senderType: "CUSTOMER" | "AGENT"; minutesAfterOpen: number }[] = [
  {
    senderType: "CUSTOMER",
    minutesAfterOpen: 45,
    body: `Thank you for getting back to us so quickly. To clarify our situation: we are a 25-person US-based LLC and our finance team requires all vendor payments to go through our accounts payable process, which means we need NET-30 invoicing.\n\nCan you confirm whether the Business plan supports this, and if so, how do we get set up?`,
  },
  {
    senderType: "AGENT",
    minutesAfterOpen: 110,
    body: `Hi, thanks for reaching out! Yes, the Business plan does support NET-30 invoicing — you're in the right place.\n\nTo get started, you'll need to navigate to Settings → Billing → Payment Methods and select "Invoice / NET-30" from the dropdown. From there you can enter your company billing details and a PO number if required. Once enabled, monthly invoices will be emailed to your designated billing contact.`,
  },
  {
    senderType: "CUSTOMER",
    minutesAfterOpen: 210,
    body: `That's great news, thank you. A couple of follow-up questions before we proceed:\n\n1. Can we designate a separate billing email address rather than using the account owner's email?\n2. Do you require a W-9 form or any other tax documentation from us up front?`,
  },
  {
    senderType: "AGENT",
    minutesAfterOpen: 290,
    body: `Good questions — both are easy to handle. Yes, you can set a dedicated billing email under Settings → Billing → Billing Contact; it's completely independent from the account owner's login email.\n\nFor tax documentation, we do ask for a W-9 if your annual contract value exceeds $600, in line with IRS requirements. You can upload it directly in the billing portal under "Tax Documents". If you're below that threshold for now, you can skip it and add it later if needed.`,
  },
  {
    senderType: "CUSTOMER",
    minutesAfterOpen: 400,
    body: `I've been poking around the settings and I can't seem to find the Billing section you're describing. I only see "Account", "Team", "Integrations", and "Security" in the left sidebar.\n\nIs it possible that this section is only visible to users with a specific role? I'm logged in as the account owner.`,
  },
  {
    senderType: "AGENT",
    minutesAfterOpen: 470,
    body: `That's a good catch — the Billing section is only visible to the account owner on the Business plan and above. Since you mention you're the account owner, it's possible your account is still on the Starter plan and the upgrade to Business hasn't been fully applied yet.\n\nCould you check the plan badge shown at the top of the Settings page and let me know what it says? If it shows "Starter", I can manually trigger the plan switch on our end.`,
  },
  {
    senderType: "CUSTOMER",
    minutesAfterOpen: 560,
    body: `I checked and you're right — it says "Starter" at the top. But we definitely paid for the Business plan upgrade last week; I have the receipt email from your system confirming the charge of $299.\n\nI'll forward that email to you now. Is there anything else you need from me to sort this out?`,
  },
  {
    senderType: "AGENT",
    minutesAfterOpen: 640,
    body: `Thanks for forwarding the receipt — I can see the payment came through successfully on our end. It looks like the plan entitlement didn't propagate correctly after the charge, which is a rare but known sync issue on our billing processor's side.\n\nI've manually updated your account to Business plan now. Please log out and log back in, and the Billing section should appear in Settings. Let me know once you're in and I'll walk you through enabling NET-30 from there.`,
  },
  {
    senderType: "CUSTOMER",
    minutesAfterOpen: 720,
    body: `That worked perfectly — I can now see the Billing section after logging back in. I found the "Invoice / NET-30" option and it's showing as available, so I've filled in our billing details and uploaded our W-9.\n\nThe only thing I noticed is that the "NET-30" toggle is still greyed out even after saving. Is there an approval step I'm missing?`,
  },
  {
    senderType: "AGENT",
    minutesAfterOpen: 810,
    body: `Yes — there is a one-time manual approval step for NET-30 on new accounts, which our billing team completes within one business day of receiving your W-9. I can see your document came through on our end and I've flagged it as priority for the billing team.\n\nYou'll receive a confirmation email once NET-30 is activated, typically within 24 hours. Your next invoice will then be issued under the new payment terms. Please don't hesitate to reply here if you haven't heard back by end of business tomorrow and I'll follow up directly with the billing team on your behalf.`,
  },
];

async function main() {
  const ticket = await prisma.ticket.findUnique({
    where: { id: TICKET_ID },
    select: { id: true, subject: true, createdAt: true },
  });

  if (!ticket) {
    throw new Error(`Ticket ${TICKET_ID} not found. Run seed-tickets.ts first.`);
  }

  const existing = await prisma.message.count({ where: { ticketId: TICKET_ID } });
  if (existing > 0) {
    console.log(`Deleting ${existing} existing message(s) on ticket ${TICKET_ID}...`);
    await prisma.message.deleteMany({ where: { ticketId: TICKET_ID } });
  }

  console.log(`Seeding ${messages.length} messages for ticket ${TICKET_ID}: "${ticket.subject}"`);

  for (const msg of messages) {
    await prisma.message.create({
      data: {
        ticketId: TICKET_ID,
        body: msg.body,
        senderType: msg.senderType,
        createdAt: new Date(ticket.createdAt.getTime() + msg.minutesAfterOpen * 60 * 1000),
      },
    });
  }

  console.log(`Done. ${messages.length} messages inserted.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
