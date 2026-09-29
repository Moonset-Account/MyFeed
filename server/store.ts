// 简单的 JSON 文件本地存储：写操作后整体落盘
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Database } from '../shared/types.js';
import { seedDatabase } from './seed.js';

export class Store {
  private db: Database;
  private readonly file: string | null;

  constructor(file: string | null) {
    this.file = file;
    if (file && existsSync(file)) {
      this.db = JSON.parse(readFileSync(file, 'utf8')) as Database;
    } else {
      this.db = seedDatabase();
      this.save();
    }
  }

  get data(): Database {
    return this.db;
  }

  save(): void {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.db, null, 2), 'utf8');
  }
}
