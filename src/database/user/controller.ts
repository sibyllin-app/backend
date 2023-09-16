import * as argon2 from 'argon2';
import { user } from 'database/db.instance';
import { User } from '@prisma/client';
import type { Role } from '@/routes/user/interface';

export interface CleanUser {
	id: number;
  name: string;
	role: Role,
  avatar: string | null;
  verify: boolean | null;
	creation_date: Date | null;
}

export enum enumCheckUser {
	OK = 0,
	NOT_FOUND,
	INCORRECT_PASSWORD,
	ERROR
}

export default class controller {
	static async create(data: Omit<User, 'id' | 'avatar' | 'creation_date' | 'modification_date'>): Promise<{ name: string, email: string } | null> {
		if (!data.name || !data.email || !data.password)
			return null;
		return await user.create({
			data: {
				name: data.name,
				email: data.email,
				avatar: null,
				password: await argon2.hash(data.password),
				verify: data.verify,
				token: data.token,
				token_deadline: data.token_deadline
			},
			select: {
				name: true,
				email: true
			}
		});
	}

	static findOne(nameOrId: string | number): Promise<User | null> {
		return user.findUnique({
			where: (typeof nameOrId === 'number')
				? { id: nameOrId }
				: { name: nameOrId },
		});
	}

	static findByEmail(email: string): Promise<User | null> {
		return user.findUnique({
			where: {
				email
			}
		});
	}

	static async cleanFindOne(name: string): Promise<CleanUser | null> {
		return user.findUnique({
			where: {
				name
			},
			select: {
				id: true,
				name: true,
				role: true,
				avatar: true,
				verify: true,
				creation_date: true
			}
		});
	}

	/**
	 * @param page One page contains 100 users
	 * Users order by creation_date, not by id
	 */
	static async cleanFindAll(page?: number): Promise<CleanUser[] | null> {
		const inc = 100;
		const skip = (page && page >= 0)
			? inc * (page - 1)
			: 0;
		
		return user.findMany({
			select: {
				id: true,
				name: true,
				role: true,
				avatar: true,
				verify: true,
				creation_date: true
			},
			skip,
			take: (page)
				? inc
				: undefined,
			orderBy: [
				{
					creation_date: 'desc'
				}
			]
		});
	}

	static async check(
		nameOrId: string | number,
		password: string
	): Promise<{ data: unknown, info: enumCheckUser }> {
		return new Promise((res) => {
			user.findUnique({
				where: (typeof nameOrId === 'number')
					? { id: nameOrId }
					: { name: nameOrId }
			})
				.then((d) => {
					if (!d)
						return res({ data: null, info: enumCheckUser.NOT_FOUND });
					argon2.verify(d.password, password)
						.then((val) => {
							res({ data: val, info: val
								? enumCheckUser.OK
								: enumCheckUser.INCORRECT_PASSWORD });
						})
						.catch((e) => res({ data: e, info: enumCheckUser.ERROR }));
				})
				.catch((e) => res({ data: e, info: enumCheckUser.ERROR }));
		});
	}

	static async update(data: Omit<User, 'avatar' | 'role' | 'creation_date' | 'modification_date'>, passNotChange: boolean = false): Promise<User> {
		return user.update({
			where: {
				id: data.id
			},
			data: {
				name: data.name,
				email: data.email,
				password: (passNotChange)
					? await argon2.hash(data.password)
					: data.password,
				verify: data.verify,
				token: data.token,
				token_deadline: data.token_deadline
			}
		});
	}

	static async updatePassword(user_id: number, new_password: string): Promise<boolean> {
		const update = await user.update({
			where: {
				id: user_id
			},
			data: {
				password: await argon2.hash(new_password)
			},
			select: {
				id: true
			}
		});

		return (update !== null);
	}

	static async updateRole(idOrName: number | string, new_role: Role): Promise<boolean> {
		const update = await user.update({
			where: (typeof idOrName === 'number')
				? { id: idOrName }
				: { name: idOrName },
			data: {
				role: new_role
			},
			select: {
				id: true
			}
		});

		return (update !== null);
	}

	static delete(nameOrId: string | number): Promise<User> {
		return user.delete({
			where: (typeof nameOrId === 'number')
				? { id: nameOrId }
				: { name: nameOrId }
		});
	}

	static async isExist(id: number): Promise<boolean> {
		return ((await user.findUnique({
			where: {
				id
			}
		})) !== null);
	}

	static async userRole(id: number): Promise<Role | null> {
		const userRole = await user.findUnique({
			where: {
				id
			},
			select: {
				role: true
			}
		});

		if (!userRole)
			return null;
		return userRole.role as Role;
	}
}
