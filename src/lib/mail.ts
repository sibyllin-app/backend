import { readFile } from 'fs/promises';
import { resolve } from 'path';
import nodemailer from 'nodemailer';
import { log } from 'lib/log';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export type MailReturn = Promise<boolean>;
export interface MailInfo {
	from?: string;
	to: string;
	subject: string;
}

export class MailError extends Error {
	public code = 500;

	constructor(message: string) {
		super(message);
	}
}

export class Mail {
	private confirmMail: string;
	private passwordMail: string;
	private passwordUpdateMail: string;
	private verifyMail: string;
	private nodeMailer: nodemailer.Transporter<SMTPTransport.SentMessageInfo>;
	public defaultMail: string;

	constructor(defaultMail?: string) {
		this.confirmMail = '';
		this.passwordMail = '';
		this.passwordUpdateMail = '';
		this.verifyMail = '';
		this.nodeMailer = nodemailer.createTransport(
			(process.env.NODE_ENV === 'production')
				? {
					host: process.env.BACKEND_MAIL_HOST,
					port: 465,
					secure: true,
					auth: {
						user: process.env.BACKEND_MAIL_USER,
						pass: process.env.BACKEND_MAIL_PASS
					}
				}
				: {
					host: 'localhost',
					port: 7895
				}
		);
		this.defaultMail = defaultMail ?? 'Sibyllin <hello@sibyllin.app';

		readFile(resolve('.', 'mail', 'dist', 'confirm.html'), { encoding: 'utf-8' })
			.then((d) => this.confirmMail = d);
		readFile(resolve('.', 'mail', 'dist', 'password.html'), { encoding: 'utf-8' })
			.then((d) => this.passwordMail = d);
		readFile(resolve('.', 'mail', 'dist', 'passwordUpdate.html'), { encoding: 'utf-8' })
			.then((d) => this.passwordUpdateMail = d);
		readFile(resolve('.', 'mail', 'dist', 'verify.html'), { encoding: 'utf-8' })
			.then((d) => this.verifyMail = d);
	}

	private formatString(str: string, args: Record<string, unknown>): string {
		const matchs = str.matchAll(/(?<main>{{[ \t]*(?<key>[\S]+)[ \t]*}})/gi);
		const currentYear = new Date().getFullYear(), originYear = 2023;
		let x = 0, ret = '';

		for (const match of matchs) {
			if (!match.index || !match.groups || !match.groups.key)
				continue;
			const val = (match.groups.key !== 'date')
				? args[match.groups.key]
				: (currentYear > originYear)
					? `${originYear} - ${currentYear}`
					: `${originYear}`;
			ret += str.substring(x, match.index);
			ret += val ?? match.groups.main;
			x = match.index + match.groups.main.length;
		}
		ret += str.substring(x).trim();
		return ret;
	}

	private send(mailData: string, mailInfo: MailInfo, args?: Record<string, unknown>): MailReturn {
		return new Promise((res, rej) => {
			this.nodeMailer.sendMail({
				from: mailInfo.from ?? this.defaultMail,
				to: mailInfo.to,
				subject: mailInfo.subject,
				html: this.formatString(mailData, args ?? {})
			}, (err, info) => {
				if (err)
					return rej(new MailError(err.message));
				if (info.accepted && info.accepted.length) {
					log.info('Mail send with id', info.messageId);
					return res(true);
				}
				log.info('Mail rejected with id', info.messageId);
				return rej(new MailError('Mail rejected'));
			});
		});
	}

	connectionCode(to: string, args: Record<'token', string>): MailReturn {
		return this.send(this.confirmMail, {
			from: 'Sibyllin <verify@sibyllin.app>',
			to,
			subject: 'Sibyllin connection code'
		}, args);
	}

	resetPassword(to: string, args: Record<'url', string>): MailReturn {
		return this.send(this.passwordMail, {
			from: 'Sibyllin <verify@sibyllin.app>',
			to,
			subject: 'Sibyllin password reset'
		}, args);
	}

	passwordUpdate(to: string): MailReturn {
		return this.send(this.passwordUpdateMail, {
			from: 'Sibyllin <verify@sibyllin.app>',
			to,
			subject: 'Sibyllin password update'
		});
	}

	accountVerification(to: string, args: Record<'token', string>): MailReturn {
		return this.send(this.verifyMail, {
			from: 'Sibyllin <verify@sibyllin.app>',
			to,
			subject: 'Sibyllin account verification'
		}, args);
	}
}

const mailInstance = new Mail();

export default mailInstance;
