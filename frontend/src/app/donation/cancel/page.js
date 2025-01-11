'use client';

import { useRouter } from 'next/navigation';

export default function CancelPage({
                                       title = "Payment Cancelled",
                                       description = "Your donation has been cancelled. No payment has been processed.",
                                       returnText = "Return to Donation Page"
                                   }) {
    const router = useRouter();

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full text-center">
                <div className="text-red-500 text-6xl mb-4">×</div>
                <h1 className="text-2xl font-bold text-primary-700 mb-4">
                    {title}
                </h1>
                <p className="text-gray-600 mb-6">
                    {description}
                </p>
                <button
                    onClick={() => router.push('/donate')}
                    className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg"
                >
                    {returnText}
                </button>
            </div>
        </div>
    );
}
