/* 
 *  © 3S System Software Support, Winterthur, Switzerland
 *  Author:        Thomas Jakober <tj at 3sweb.net>
 *  Created:       18.01.2019, 19:07:48
 *  Program Title: 
 *  File Name:     b.js
 */
class b {
  constructor(a) {
    this.a = a;
  }
  
  perform() {
    console.log('class b called');
    this.a.say("I'm in b");
  }
}
exports = b;
