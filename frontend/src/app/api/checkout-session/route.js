import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    try {
        if (sessionId) {
            const session = await stripe.checkout.sessions.retrieve(sessionId, {
                expand: ['payment_intent', 'subscription'],
            });

            return NextResponse.json({
                payment_intent: session.payment_intent?.id || session.subscription?.id,
                customer_email: session.customer_email,
                amount_total: session.amount_total,
                subscription: session.subscription ? true : false,
            });
        } else {
            return NextResponse.json(
                { error: 'Session ID is required' },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: error.statusCode || 500 }
        );
    }
}
