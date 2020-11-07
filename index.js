require('dotenv').config()

const logFileName = process.env.LOGGING_FILENAME;
const flightRadarApiUrl = process.env.FLIGHTS_FETCH_URL;
const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

const Log = require('log-to-file');
const CronJob = require('cron').CronJob;
const { GoogleSpreadsheet } = require('google-spreadsheet');
const axios = require('axios').default;

const spreadsheet = new GoogleSpreadsheet(spreadsheetId);
const header = ['Origem', 'Destino', 'Voo', 'Aeronave', 'Posicao'];

const dataSyncJob = new CronJob('30 * * * * *', () => {
    Log(`Iniciando busca de dados...`, logFileName);
    axios.get(flightRadarApiUrl).then(json => {
        let data = json.data;
        let flights = obterListaDeVoos(data);
        let numberOfFlights = Object.keys(flights).length;

        Log(`${numberOfFlights} voos foram encontrados sobrevoando a região Nordeste do Brasil.`, logFileName);

        (async() => {
            await spreadsheet.useServiceAccountAuth({
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY
            });

            await spreadsheet.loadInfo();
            
            let sheet = spreadsheet.sheetsByIndex[0];           

            await sheet.clear();

            let hasHeader = !!sheet.headerValues;

            const newRows = Object.keys(flights).map(key => {
                let flight = flights[key];
                let flightObject = 
                { 
                    Origem: flight[11], 
                    Destino: flight[12], 
                    Voo: flight[13], 
                    Aeronave: flight[8], 
                    Posicao: `${flight[1]},${flight[2]}` 
                };

                return flightObject;
            });

            if (!hasHeader) {
                await sheet.setHeaderRow(header);
            }

            await sheet.addRows(newRows);

            Log(`${newRows.length} registros salvos na planilha`, logFileName);
        })();

    });    
}, null, true, 'America/Fortaleza');

dataSyncJob.start();

// ----------------------------------------------------------------------------------------------------------------------------------------------------- //

var obterListaDeVoos = data => {
    const excludingFlightKeys = ['full_count', 'version', 'stats'];
    return Object.keys(data)
        .filter(key => !excludingFlightKeys.includes(key))
        .reduce((obj, key) => {
            obj[key] = data[key];
            return obj;
        }, {});
}