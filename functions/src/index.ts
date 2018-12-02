import * as functions from 'firebase-functions';
import {
  dialogflow,
  Image,
  Table,
  Button,
  SimpleResponse,
} from 'actions-on-google';
import {lineNamesEnum, serviceCodesEnum, convertCode} from './util';
import {fetchTrainTimetable, fetchBusTimetable} from './wmata';

const app = dialogflow({debug: true});

/**
 * DiagFlow intent for the DC Metro timetable.
 */
app.intent(
  'metro_timetable',
  async (
    conv: any,
    {transport, station}: {transport: string, station: string}
  ) => {
    const transportParam = transport.toLowerCase();

    if (transportParam === 'train' || transportParam === 'rail') {
      const timetable: any = await fetchTrainTimetable(station);

      if (!timetable) {
        conv.ask(
          'I was not able to find a station by that name. Please try making your request more specific and try again.'
        );
      } else {
        // Generates the neccersary table cells for display devices.
        const timetableCells = timetable.predictions.map((item) => {
          return {
            cells: [
              lineNamesEnum[item.Line] || 'TBD',
              item.Destination || 'TDB',
              item.Car || 'TBD',
              convertCode(item.Min || 'TBD', serviceCodesEnum),
            ],
          };
        });

        if (!timetableCells.length) {
          conv.ask(
            'There are no trains currently scheduled to stop at this station.'
          );
        } else {
          conv.ask(
            new SimpleResponse({
              speech: `The next train arriving at ${
                timetable.stationName
              } is a ${
                lineNamesEnum[timetable.predictions[0].Line]
              } line train and has a final calling point at ${
                timetable.predictions[0].Destination
              }. ${
                timetable.predictions[0].Min === 'ARR'
                  ? `It's arriving now.`
                  : timetable.predictions[0].Min === 'BRD'
                  ? `It's boarding now.`
                  : `It arrives in ${timetable.predictions[0].Min} minutes.`
              }`,
              text: `The next train arriving at ${
                timetable.stationName
              } has a final calling point at ${
                timetable.predictions[0].Destination
              }. ${
                timetable.predictions[0].Min === 'ARR'
                  ? `It's arriving now.`
                  : timetable.predictions[0].Min === 'BRD'
                  ? `It's boarding now.`
                  : `It arrives in ${timetable.predictions[0].Min} minutes.`
              }`,
            })
          );

          /* As this data can only be displayed on a screen, we check if the user actually has one
          before the payload is sent. */
          if (
            conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT')
          ) {
            conv.ask(
              new Table({
                title: timetable.stationName,
                subtitle: new Date().toLocaleString(),
                image: new Image({
                  url:
                    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/WMATA_Metro_Logo_small.svg/1024px-WMATA_Metro_Logo_small.svg.png',
                  alt: 'DC Metro Logo',
                }),
                columns: [
                  {
                    header: 'Line',
                    align: 'LEADING',
                  },
                  {
                    header: 'Destination',
                    align: 'CENTER',
                  },
                  {
                    header: 'Car',
                  },
                  {
                    header: 'Arrival',
                    align: 'TRAILING',
                  },
                ],
                rows: timetableCells,
                buttons: new Button({
                  title: 'Issues and Feedback',
                  url:
                    'https://github.com/JamesIves/dc-metro-google-action/issues',
                }),
              })
            );
          }
        }
      }
    } else {
      const timetable: any = await fetchBusTimetable(station);

      if (timetable.Predictions) {
        const timetableCells = timetable.Predictions.map((item) => {
          return {
            cells: [
              item.RouteID || 'TBD',
              item.DirectionText || 'TDB',
              convertCode(item.Minutes.toString() || 'TBD', serviceCodesEnum),
            ],
          };
        });

        if (!timetableCells.length) {
          conv.ask(
            'There are currently no buses scheduled to arrive at this stop.'
          );
        } else {
          conv.ask(
            new SimpleResponse({
              speech: `The next bus arriving at this stop is bound for ${
                timetable.Predictions[0].DirectionText
              } is due to arrive in ${
                timetable.Predictions[0].Minutes
              } minutes.`,
              text: `The next bus arriving at stop ${
                timetable.StopName
              } is bound for ${
                timetable.Predictions[0].DirectionText
              } ans is due to arrive in ${
                timetable.Predictions[0].Minutes
              } minutes.`,
            })
          );

          /* Makes sure the user has a screen output before sending it table data. */
          if (
            conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT')
          ) {
            conv.ask(
              new Table({
                title: timetable.StopName,
                subtitle: new Date().toLocaleString(),
                image: new Image({
                  url:
                    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/WMATA_Metro_Logo_small.svg/1024px-WMATA_Metro_Logo_small.svg.png',
                  alt: 'DC Metro Logo',
                }),
                columns: [
                  {
                    header: 'Route',
                    align: 'LEADING',
                  },
                  {
                    header: 'Destination',
                  },
                  {
                    header: 'Arrival',
                    align: 'TRAILING',
                  },
                ],
                rows: timetableCells,
                buttons: new Button({
                  title: 'Issues and Feedback',
                  url:
                    'https://github.com/JamesIves/dc-metro-google-action/issues',
                }),
              })
            );
          }
        }
      } else {
        conv.ask('I could not locate a bus stop with that number.');
      }
    }
  }
);

exports.dcMetro = functions.https.onRequest(app);