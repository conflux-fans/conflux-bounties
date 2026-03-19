/*
 * Copyright 2025 Conflux DevKit Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Simple logger utility
 */

const colors = {
  info: '\x1b[36m', // Cyan
  warn: '\x1b[33m', // Yellow
  error: '\x1b[31m', // Red
  success: '\x1b[32m', // Green
  reset: '\x1b[0m', // Reset
};

function formatMessage(level: string, message: string, ...args: any[]): string {
  const timestamp = new Date().toISOString();
  const formattedArgs =
    args.length > 0
      ? ` ${args
          .map((arg) =>
            typeof arg === 'object'
              ? JSON.stringify(
                  arg,
                  (_key, value) =>
                    typeof value === 'bigint' ? value.toString() : value,
                  2
                )
              : String(arg)
          )
          .join(' ')}`
      : '';

  return `[${timestamp}] ${level.toUpperCase()}: ${message}${formattedArgs}`;
}

export const logger = {
  info(message: string, ...args: any[]) {
    console.log(
      colors.info + formatMessage('info', message, ...args) + colors.reset
    );
  },

  warn(message: string, ...args: any[]) {
    console.warn(
      colors.warn + formatMessage('warn', message, ...args) + colors.reset
    );
  },

  error(message: string, ...args: any[]) {
    console.error(
      colors.error + formatMessage('error', message, ...args) + colors.reset
    );
  },

  success(message: string, ...args: any[]) {
    console.log(
      colors.success + formatMessage('success', message, ...args) + colors.reset
    );
  },
};
