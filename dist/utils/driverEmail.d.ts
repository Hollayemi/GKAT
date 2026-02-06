interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}
export declare const sendEmail: (options: EmailOptions) => Promise<void>;
export declare const driverEmailTemplates: {
    passwordSetup: (fullName: string, setupUrl: string) => string;
    passwordSetupResend: (fullName: string, setupUrl: string) => string;
    verificationApproved: (fullName: string, loginUrl: string) => string;
    verificationRejected: (fullName: string, reason: string) => string;
    accountSuspended: (fullName: string, reason: string, duration?: number, suspendedUntil?: Date) => string;
    accountDisabled: (fullName: string, reason: string) => string;
};
export {};
//# sourceMappingURL=driverEmail.d.ts.map