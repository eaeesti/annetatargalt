import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { makeDonationRequest } from '@/utils/donation';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request) {
    const body = await request.text();
    const headersList = headers();
    const sig = headersList.get('stripe-signature');

    let event;

    try {
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return NextResponse.json(
            { error: `Webhook Error: ${err.message}` },
            { status: 400 }
        );
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;

            // Extract metadata
            const {
                donationType,
                firstName,
                lastName,
                idCode,
                proportions,
                companyName,
                companyCode,
                dedicationName,
                dedicationEmail,
                dedicationMessage,
            } = session.metadata;

            // Prepare donation data in the same format as the original request
            const donationData = {
                amount: session.amount_total / 100, // Convert from cents back to decimal
                type: donationType,
                firstName,
                lastName,
                email: session.customer_email,
                idCode,
                proportions: JSON.parse(proportions),
                stripeSessionId: session.id,
            };

            // Add optional fields if they exist
            if (companyName) {
                donationData.companyName = companyName;
                donationData.companyCode = companyCode;
            }

            if (dedicationName && donationType === 'onetime') {
                donationData.dedicationName = dedicationName;
                donationData.dedicationEmail = dedicationEmail;
                donationData.dedicationMessage = dedicationMessage;
            }

            try {
                const response = await makeDonationRequest(donationData);

                if (!response.ok) {
                    const error = await response.json();
                    console.error('Error sending donation to Strapi:', error);
                    // We don't throw here as we don't want Stripe to retry the webhook
                    // Just log the error and continue
                }
            } catch (error) {
                console.error('Error processing donation:', error);
            }
            break;
        }

        case 'payment_intent.payment_failed': {
            const paymentIntent = event.data.object;
            console.error('Failed payment for PaymentIntent:', paymentIntent.id);
            break;
        }

        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            console.error('Subscription cancelled:', subscription.id);
            break;
        }
    }

    return NextResponse.json({ received: true });
}

export const config = {
    api: {
        bodyParser: false,
    },
};
