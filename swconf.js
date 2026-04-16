//import { StatsRecorder } from './statsrecorder.js';
//import { StatsServer } from './statsserver.js';
//import { Miyo } from './miyointerface.js';
//import { SunSwitch } from './sunswitch.js';



export class swconf {
    constructor() {
        this.aDevices = ['StatsRecorder', 'StatsServer'];
        /*
         * Now start nodejs devices
         */
        setTimeout(() => {
            if (this.aDevices.includes('StatsServer')) {
                import('./statsserver.js').then(({StatsServer}) => {
                    super.statsserver = new StatsServer('database.json');
                }).catch(err => console.error('Failed to load statsserver.js:', err));
            }
            if (this.aDevices.includes('StatsRecorder')) {
                import('./statsrecorder.js').then(({StatsRecorder}) => {
                    super.statsrecorder = new StatsRecorder('database.json');
                }).catch(err => console.error('Failed to load statsrecorder.js:', err));
            }
/*            if (this.aDevices.includes('MiyoInterface')) {
                import('.miyointerface.js').then(({Miyo}) => {
                    super.miyo = new Miyo();
                });
            }*/
            if (this.aDevices.includes('SunSwitch')) {
                import('./sunswitch.js').then(({SunSwitch}) => {
                    super.sunswitch = new SunSwitch('sunswitch_config.json');
                }).catch(err => console.error('Failed to load sunswitch.js:', err));
            }
        }, 1000);
    };
}
