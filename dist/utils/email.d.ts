interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}
export declare const sendEmail: (options: EmailOptions) => Promise<void>;
export declare const emailTemplates: {
    welcome: (fullName: string, email: string, password: string, roleName: string) => string;
    passwordReset: (fullName: string, temporaryPassword: string) => string;
    accountSuspended: (fullName: string, reason: string, duration?: number, suspendedUntil?: Date) => string;
    accountDisabled: (fullName: string, reason: string) => string;
};
export {};
//# sourceMappingURL=email.d.ts.map