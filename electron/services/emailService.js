const nodemailer = require('nodemailer');
const fs = require('fs');
const { BRAND } = require('../brand');
const { documentEmail } = require('./emailTemplates');

/**
 * Properly strip HTML tags from a string.
 * Uses a loop to ensure all tags are removed (fixes CodeQL incomplete multi-character sanitization)
 */
function stripHtmlTags(html) {
    if (!html) return '';
    let text = html;
    let previous;
    // Loop until no more tags are found
    do {
        previous = text;
        text = text.replace(/<[^>]*>/g, '');
    } while (text !== previous);
    // Also clean up extra whitespace
    return text.replace(/\s+/g, ' ').trim();
}

let transporter = null;

// Initialize email transporter with SMTP settings
function initEmailService(settings) {
    if (!settings.smtp_host || !settings.smtp_user) {
        console.log('Email service: SMTP not configured');
        return false;
    }

    try {
        transporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: settings.smtp_port || 587,
            secure: settings.smtp_secure || false,
            auth: {
                user: settings.smtp_user,
                pass: settings.smtp_pass,
            },
        });

        console.log('Email service initialized');
        return true;
    } catch (error) {
        console.error('Failed to initialize email service:', error);
        return false;
    }
}

// Send email with optional attachments
async function sendEmail({ to, subject, html, text, attachments = [] }) {
    if (!transporter) {
        throw new Error('Email service not initialized. Please configure SMTP settings.');
    }

    const mailOptions = {
        from: transporter.options.auth.user,
        to,
        subject,
        html,
        // Use a loop to properly strip HTML tags (fixes CodeQL multi-character sanitization)
        text: text || stripHtmlTags(html),
        attachments,
    };

    const result = await transporter.sendMail(mailOptions);
    return result;
}

// Test SMTP connection
async function testEmailConnection(settings) {
    try {
        console.log('Testing email connection with settings:', JSON.stringify(settings, null, 2));

        if (!settings.smtp_host) {
            return { success: false, message: 'SMTP Host is missing. Please enter a valid host (e.g., smtp.gmail.com)' };
        }

        if (!settings.auth || !settings.auth.user || !settings.auth.pass) {
            // If auth is just settings.smtp_user/pass on top level, re-map or check
            // The incoming settings object already maps user/pass to auth object in createTransport below? No.
            // Look at lines 112-115 below. It maps settings.smtp_user to auth.user.
        }

        const testTransporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: settings.smtp_port || 587,
            secure: settings.smtp_secure || false,
            auth: {
                user: settings.smtp_user,
                pass: settings.smtp_pass,
            },
        });

        await testTransporter.verify();
        return { success: true, message: 'SMTP connection successful' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Send test email
async function sendTestEmail(settings, toEmail) {
    try {
        const testTransporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: settings.smtp_port || 587,
            secure: settings.smtp_secure || false,
            auth: {
                user: settings.smtp_user,
                pass: settings.smtp_pass,
            },
        });

        await testTransporter.sendMail({
            from: settings.smtp_user,
            to: toEmail,
            subject: `${BRAND.productName} - Test e-mail`,
            html: `
        <h2>Email Configuration Test</h2>
        <p>This is a test email from your point of sale system.</p>
        <p>If you received this email, your SMTP settings are configured correctly!</p>
        <p><small>Sent at: ${new Date().toLocaleString()}</small></p>
      `,
        });

        return { success: true, message: 'Test email sent successfully' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Send quotation email with PDF attachment (shop's language, amounts in dinars)
async function sendQuotationEmail({ to, quote, businessInfo, pdfPath }) {
    const { subject, html } = documentEmail('quotation', {
        number: quote.quote_number, date: quote.created_at, to: quote.customer_name,
        lines: (quote.items || []).map(i => ({ name: i.product_name, qty: i.quantity, price: i.unit_price, total: i.total })),
        subtotal: quote.subtotal, discount: quote.discount_amount, tax: quote.tax_amount, total: quote.total, note: quote.notes,
    }, businessInfo);
    const attachments = [];
    if (pdfPath && fs.existsSync(pdfPath)) attachments.push({ filename: `Quotation_${quote.quote_number}.pdf`, path: pdfPath });
    return sendEmail({ to, subject, html, attachments });
}

module.exports = {
    initEmailService,
    sendEmail,
    sendQuotationEmail,
    testEmailConnection,
    sendTestEmail,
};
