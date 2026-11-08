// Data copied from mockup v12 (maquette-accueil.html).
const HB = "Hellblade: Senua's Sacrifice";
type T = "plat" | "gold" | "silver" | "bronze";
export const RECENT: { n: string; d: string; g: string; t: T; r: number; w: string; i: string }[] = [
 {n:"You Are The Special",d:"Get all other Trophies.",g:"Magicka 2",t:"plat",r:1.30,w:"5 Nov 2026, 00:16",i:"trophy/s/3589/6a14691b-03bf-42eb-83f9-fef8e6d89ebd.png"},
 {n:"Archmage",d:"Kill 10,000 enemies.",g:"Magicka 2",t:"silver",r:1.51,w:"5 Nov 2026, 00:16",i:"trophy/s/3589/41e5c293-83c6-4b20-a6c8-3ea5660ff27f.png"},
 {n:"Done",d:"Collect all of the other trophies",g:HB,t:"plat",r:50.82,w:"4 Nov 2026, 21:30",i:"trophy/s/35777/78fda04a-169f-4b25-8cba-1c9793cdf29b.png"},
 {n:"The Final Battle",d:"Confront Hela",g:HB,t:"gold",r:55.09,w:"4 Nov 2026, 21:30",i:"trophy/s/35777/af4284b6-af5d-4ece-af2b-d69d4fa939c6.png"},
 {n:"Stories From the North",d:"Collect all of the Lorestones",g:HB,t:"gold",r:50.86,w:"4 Nov 2026, 20:56",i:"trophy/s/35777/4b160b50-cad6-4efb-a9de-e256fc26418d.png"},
 {n:"Tamed the Beast",d:"Defeat Fenrir",g:HB,t:"gold",r:55.32,w:"4 Nov 2026, 17:47",i:"trophy/s/35777/df3da837-4af3-458f-8997-8a6091f4a3dd.png"},
 {n:"Into the Mountain",d:"Enter Helheim",g:HB,t:"gold",r:55.64,w:"4 Nov 2026, 16:15",i:"trophy/s/35777/a6fda35d-49fb-486a-8183-fa3292f1c597.png"},
 {n:"Warrior",d:"Escape the Sea of Corpses",g:HB,t:"silver",r:55.73,w:"4 Nov 2026, 15:45",i:"trophy/s/35777/cab7c3b0-2443-4bbc-87c4-ba5d74669493.png"},
 {n:"Gramr Released",d:"Pull Gramr out of the Tree",g:HB,t:"gold",r:55.79,w:"4 Nov 2026, 15:28",i:"trophy/s/35777/98f05c00-320b-403d-9526-cb71fa73d662.png"},
 {n:"Trust Your Senses",d:"Complete the Blindness Shard Challenge",g:HB,t:"silver",r:55.96,w:"4 Nov 2026, 14:48",i:"trophy/s/35777/e880369d-5ad9-49f1-87d3-b8cdb02b6fe3.png"},
 {n:"Cure For The Plague",d:"Complete the Swamp Shard Challenge",g:HB,t:"silver",r:56.00,w:"4 Nov 2026, 14:23",i:"trophy/s/35777/8a0ffdee-45b4-4ebd-abde-275efe4bce1c.png"},
 {n:"Different Perspectives",d:"Complete the Tower Shard Challenge",g:HB,t:"silver",r:56.22,w:"4 Nov 2026, 13:39",i:"trophy/s/35777/d3497970-952c-4c59-967a-987e8581b6a0.png"},
 {n:"Escaped",d:"Complete the Labyrinth Shard Challenge",g:HB,t:"silver",r:56.55,w:"4 Nov 2026, 12:48",i:"trophy/s/35777/a13dc341-6af6-4afd-9f21-75bae916e849.png"},
 {n:"Source of The Darkness",d:"Meet Hela for the first time on the Bridge",g:HB,t:"gold",r:57.95,w:"3 Nov 2026, 20:03",i:"trophy/s/35777/7c149d02-dc14-426c-a6af-e71dc6597f9a.png"},
 {n:"Extinguished",d:"Defeat Surtr",g:HB,t:"gold",r:61.48,w:"3 Nov 2026, 19:27",i:"trophy/s/35777/5755b078-5daf-4973-aa14-371421bf2882.png"},
 {n:"Master of Illusion",d:"Defeat Valravn",g:HB,t:"gold",r:62.94,w:"3 Nov 2026, 16:21",i:"trophy/s/35777/95914f4d-b874-449f-aa61-b0a1a7d8e020.png"},
 {n:"The Fight Begins",d:"Reaching the Gate for the first time",g:HB,t:"gold",r:81.03,w:"2 Nov 2026, 22:50",i:"trophy/s/35777/c4a73582-3f12-4a9d-a209-b996076c5dbf.png"},
 {n:"Oh, My Bad",d:"Kill your friends 1000 times.",g:"Magicka 2",t:"silver",r:1.41,w:"2 Nov 2026, 21:36",i:"trophy/s/3589/372ed2d8-ea87-4dba-95c0-48dfc5ef0fd0.png"},
 {n:"RESS PLZ!",d:"Revive your friends 1000 times.",g:"Magicka 2",t:"silver",r:1.98,w:"2 Nov 2026, 21:09",i:"trophy/s/3589/7fcecc98-76ed-41cf-b4b5-e7f58138c76e.png"},
 {n:"Personal growth",d:"Collect all trophies",g:"Gris",t:"plat",r:47.57,w:"2 Nov 2026, 20:35",i:"trophy/s/19936/84f017b2-0031-48e9-a021-c6530972e51a.png"}
];
export const GAMES: { n: string; p: string; ph?: boolean; i?: string; last: string; h?: string; c: number[]; pr: number }[] = [
 {n:"Phantom Blade Zero",p:"PS5",ph:true,last:"5 Nov 2026",h:"5m",c:[0,1,0,3,0,14,0,18],pr:0},
 {n:"Magicka 2",p:"PS4",i:"game/s/3589/a0f14bbb-72f5-4fdd-a927-4094055c8773.png",last:"5 Nov 2026",h:"33h 27m",c:[1,1,2,2,14,14,30,30],pr:100},
 {n:HB,p:"PS5",i:"game/s/35777/8a8e90a3-028e-425e-ab66-59d9cb4ce274.png",last:"4 Nov 2026",h:"11h 46m",c:[1,1,9,9,5,5,0,0],pr:100},
 {n:"Gris",p:"PS5",i:"game/s/19936/12bca8ac-e096-4847-81c6-404273462efa.png",last:"2 Nov 2026",h:"10h 37m",c:[1,1,9,9,4,4,4,4],pr:100},
 {n:"Destiny 2",p:"PS5",i:"game/s/11984/cd306133-9a36-45e4-9e4b-72cf8deda29a.png",last:"1 Nov 2026",h:"240h 44m",c:[1,1,11,11,4,4,8,8],pr:100},
 {n:"The Wolf Among Us Remastered",p:"PS5",i:"game/s/43292/e54c90f7-2f79-47ac-a89c-cfd5cb21a418.png",last:"31 Oct 2026",h:"12h 44m",c:[1,1,5,5,7,7,26,26],pr:100},
 {n:"Final Fantasy Resonance",p:"PS5",i:"game/s/43178/ae6bc487-c707-47d1-93da-fca31ce64183.png",last:"29 Oct 2026",h:"66h 02m",c:[1,1,4,4,7,7,28,28],pr:100},
 {n:"Uncharted 4: A Thief's End",p:"PS4",i:"game/s/4719/82c6538d-9abb-48cb-8e7d-27dc35bceb07.png",last:"26 Oct 2026",h:"69h 58m",c:[1,1,1,1,10,10,56,56],pr:100},
 {n:"Destiny 2",p:"PS4",i:"game/s/6550/cee4332b-90f3-40ae-a547-d37173be6a5d.png",last:"24 Oct 2026",h:"3m",c:[0,1,10,11,4,4,8,8],pr:93},
 {n:"Horizon Forbidden West",p:"PS4",i:"game/s/15451/59ed3702-7fdb-4a09-aee4-494ff316cbc2.png",last:"12 Oct 2026",h:"61h 53m",c:[1,1,1,1,7,7,53,53],pr:100},
 {n:"Tales of Arise",p:"PS4",i:"game/s/13898/eb6fa70e-66f9-4ddc-bd72-ed6cfb1e876b.png",last:"11 Oct 2026",h:"49h 39m",c:[1,1,2,2,13,13,43,43],pr:100},
 {n:"Final Fantasy XV Multiplayer: Comrades",p:"PS4",i:"game/s/8563/174a994a-0be7-42e9-b629-5b16e8be9aa0.png",last:"10 Oct 2026",h:"11h 00m",c:[0,0,3,3,3,3,10,10],pr:100},
 {n:"A Hat in Time",p:"PS4",i:"game/s/6921/dc253355-e5f6-40a3-b132-5158167ffa4d.png",last:"9 Oct 2026",h:"45h 35m",c:[1,1,7,8,15,15,14,14],pr:93},
 {n:"Nioh 3",p:"PS5",i:"game/s/39667/e9c561f1-e3c5-41e4-9017-1eb8d9eda0f4.png",last:"17 Feb 2026",c:[1,1,2,4,10,14,38,45],pr:84},
 {n:"The Last of Us Part II Remastered",p:"PS5",i:"game/s/25442/f12f94d4-2c24-4066-ac71-340428f17c8c.png",last:"22 Jan 2024",c:[1,1,7,9,9,13,11,22],pr:71},
 {n:"Have a Nice Death",p:"PS5",i:"game/s/24850/89bd4390-9747-4fec-abe9-dcf06d43c2d1.png",last:"16 Dec 2023",c:[0,1,0,3,0,8,4,26],pr:5},
 {n:"Monster Hunter Rise",p:"PS5",i:"game/s/20635/4a7ba4e3-9c30-436a-be81-7e5fc27103e3.png",last:"16 Dec 2023",c:[0,1,0,5,0,20,1,74],pr:1},
 {n:"Final Fantasy XIV",p:"PS5",i:"game/s/12696/cabf9666-ee7e-417f-91a5-b1f9b769fcbd.png",last:"6 Feb 2023",c:[0,1,0,14,13,60,63,172],pr:27},
 {n:"Crash Bandicoot 4: It's About Time",p:"PS5",i:"game/s/12432/a8e4c8d8-b4bf-4e01-bee4-ca74f07c4d37.png",last:"27 Nov 2022",c:[0,1,0,4,0,8,22,39],pr:31},
 {n:"Atelier Sophie 2: The Alchemist of the Mysterious Dream",p:"PS4",i:"game/s/15519/b357975e-1867-4e6b-8f94-5e1545f8ec03.png",last:"19 Sep 2022",c:[0,1,1,2,12,13,32,32],pr:88},
 {n:"Stranger of Paradise: Final Fantasy Origin",p:"PS4",i:"game/s/15719/7a11dba0-92f5-4251-8dcf-5ddc934334ec.png",last:"21 Jul 2022",c:[1,1,3,5,8,12,46,65],pr:75}
];

export const CABINET: { n: string; g: string; r: number; i: string }[] = [
 {n:"The Greatest Expedition in History",g:"Clair Obscur: Expedition 33",r:39.72,i:"trophy/s/33395/45a58139-26d4-4e25-8d69-2444a1c34803.png"},
 {n:"Heroes of Gaia",g:"Final Fantasy IX",r:7.84,i:"trophy/s/6669/20ff8de9-5f45-4455-8bc4-27c4b9ffdd2b.png"},
 {n:"Elden Ring",g:"Elden Ring",r:37.58,i:"trophy/s/15539/b0d9a703-d112-4415-b64e-b7093cabe18c.png"},
 {n:"It can't be for nothing",g:"The Last of Us Remastered",r:4.64,i:"trophy/s/2752/f737e75b-4963-4d6d-a175-9a8428d2a726.png"},
 {n:"Goddess of Nightmares",g:"Hades II",r:35.62,i:"trophy/s/41018/c22dc387-35bf-4e8d-a8c4-2642f05779d1.png"},
 {n:"Pride of Baldur's Gate",g:"Baldur's Gate III",r:6.03,i:"trophy/s/23531/7e475664-7e40-4493-9785-99be0df800bd.png"},
 {n:"The Planet's Hope",g:"Final Fantasy VII Rebirth",r:14.27,i:"trophy/s/26098/f92396c0-f79e-4340-bdb1-384d1ea55736.png"},
 {n:"Deity",g:"Divinity: Original Sin 2",r:5.33,i:"trophy/s/7991/c4438620-23f8-4f88-9b4a-eb384ca5a367.png"},
 {n:"Champion of Ivalice",g:"Final Fantasy XII: The Zodiac Age",r:11.44,i:"trophy/s/5788/a576f128-7983-42a5-aadc-c3535484b9c2.png"},
 {n:"Original Sinner",g:"Divinity: Original Sin",r:2.43,i:"trophy/s/4007/7c283d4d-9186-4371-b42b-2881624b0e0f.png"}
];
export const RAREST: { n: string; g: string; r: number; i: string }[] = [
 {n:"Ultimate Driver",g:"Gran Turismo Sport",r:1.19,i:"trophy/s/6806/4997345e-da38-4eb9-8eaa-3fd5dd8fb84a.png"},
 {n:"You Are The Special",g:"Magicka 2",r:1.30,i:"trophy/s/3589/6a14691b-03bf-42eb-83f9-fef8e6d89ebd.png"},
 {n:"To Live Forever",g:"No Man's Sky",r:1.34,i:"trophy/s/5155/982cad65-7044-462d-8797-9f7e46cba4f2.png"},
 {n:"Oh, My Bad",g:"Magicka 2",r:1.41,i:"trophy/s/3589/372ed2d8-ea87-4dba-95c0-48dfc5ef0fd0.png"},
 {n:"Echoing Elites",g:"Diablo IV",r:1.42,i:"trophy/s/22398/a0b4e398-285a-4653-841f-5b836ce36502.png"}
];

