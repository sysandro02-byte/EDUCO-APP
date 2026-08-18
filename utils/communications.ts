export const simulateBrevoSend = async (
    settings: any, 
    contactInfo: { email?: string, phone?: string },
    message: string,
    type: 'SMS' | 'WhatsApp' | 'Email'
) => {
    if (!settings.brevoApiKey) {
        console.warn('Brevo API key is missing. Simulation skipped.');
        return false;
    }
    console.log(`[Brevo API Mock] Sending ${type} to ${contactInfo.email || contactInfo.phone}:`);
    console.log(`[Brevo API Mock] Content: ${message}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    return true;
};
