import { CoexApplication } from './application';
import { ApplicationConfig } from '@loopback/core';
import { Schedule } from './services/schedule'
const Agenda = require('agenda');
import database from './datasources/coexdb.datasource.config.json';
import { TransactionRepository, BookingRepository, UserRepository } from './repositories';
export { CoexApplication };

export async function main(options: ApplicationConfig = {
  rest: {
    cors: {
      origin: '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      preflightContinue: false,
      optionsSuccessStatus: 204,
      maxAge: 86400,
      credentials: true,
    }
  }
}) {
  const app = new CoexApplication(options);
  await app.boot();
  await app.start();

  console.log(database.user);

  Schedule.agenda = new Agenda({ db: { address: `mongodb://${database.user + (database.user != ''?':':'')}${database.password + (database.user!=''?'@':'')}${database.host}:${database.port}/${database.database}` } });
  Schedule.agenda.on("ready", function () {
    let schedule = new Schedule(app.getSync<TransactionRepository>('repositories.TransactionRepository'), app.getSync<BookingRepository>('repositories.BookingRepository'), app.getSync<UserRepository>('repositories.UserRepository'));
    schedule.define();
    Schedule.agenda.start();
    console.log("Starting agenda scheduler...");
  })

  const url = app.restServer.url;
  console.log(`Server is running at ${url}`);
  console.log(`Try ${url}/ping`);

  return app;
}
