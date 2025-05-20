// Originally made by Flykii for the Worldguessr Discord. Join at https://discord.gg/nfebQwes6a !

import { Client, GatewayIntentBits, Partials, ChannelType, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits, AttachmentBuilder } from 'discord.js';
import fs from 'fs';
import axios from 'axios';
import path from 'path';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TOKEN = ''; // BOT TOKEN 
const PB_STREAK_PATH = path.join(__dirname, 'pb_streak.json');
const LB_STREAK_PATH = path.join(__dirname, 'lb_streak.json');

const ANN_CHANNEL_ID = '' // ADMIN CHANNEL TO MAKE THE ANNOUNCEMENT FOR sendPrivateMessageOffer
const QUIZ_CHANNEL_ID = ''; // MAIN CHANNEL 
const PRIVATE_MSG_CHANNEL_ID = ''; // CHANNEL TO ANNOUNCE sendPrivateMessageOffer

const COUNTRIES_DATA = { // list of aliases for every countries and terrritories
    //africa
    "angola": {
        "flag": "🇦🇴",
        "aliases": ["angola", "ao", "🇦🇴"]
    },
    "burkina faso": {
        "flag": "🇧🇫",
        "aliases": ["burkina faso", "bf", "🇧🇫"]
    },
    "burundi": {
        "flag": "🇧🇮",
        "aliases": ["burundi", "bi", "🇧🇮"]
    },
    "benin": {
        "flag": "🇧🇯",
        "aliases": ["benin", "bj", "🇧🇯"]
    },
    "botswana": {
        "flag": "🇧🇼",
        "aliases": ["botswana", "bw", "🇧🇼"]
    },
    "democratic republic of the congo": {
        "flag": "🇨🇩",
        "aliases": ["democratic republic of the congo", "drc", "dr congo", "congo kinshasa", "🇨🇩"]
    },
    "central african republic": {
        "flag": "🇨🇫",
        "aliases": ["central african republic", "car", "cf", "🇨🇫"]
    },
    "republic of the congo": {
        "flag": "🇨🇬",
        "aliases": ["republic of the congo", "congo", "congo brazzaville", "cg", "🇨🇬"]
    },
    "ivory coast": {
        "flag": "🇨🇮",
        "aliases": ["ivory coast", "cote d'ivoire", "côte d'ivoire", "ci", "🇨🇮"]
    },
    "cameroon": {
        "flag": "🇨🇲",
        "aliases": ["cameroon", "cm", "🇨🇲"]
    },
    "cape verde": {
        "flag": "🇨🇻",
        "aliases": ["cape verde", "cv", "capo verde", "🇨🇻"]
    },
    "djibouti": {
        "flag": "🇩🇯",
        "aliases": ["djibouti", "dj", "🇩🇯"]
    },
    "algeria": {
        "flag": "🇩🇿",
        "aliases": ["algeria", "dz", "🇩🇿"]
    },
    "egypt": {
        "flag": "🇪🇬",
        "aliases": ["egypt", "eg", "🇪🇬"]
    },
    "western sahara": {
        "flag": "🇪🇭",
        "aliases": ["western sahara", "eh", "🇪🇭"]
    },
    "eritrea": {
        "flag": "🇪🇷",
        "aliases": ["eritrea", "er", "🇪🇷"]
    },
    "ethiopia": {
        "flag": "🇪🇹",
        "aliases": ["ethiopia", "et", "🇪🇹"]
    },
    "gabon": {
        "flag": "🇬🇦",
        "aliases": ["gabon", "ga", "🇬🇦"]
    },
    "ghana": {
        "flag": "🇬🇭",
        "aliases": ["ghana", "gh", "🇬🇭"]
    },
    "gambia": {
        "flag": "🇬🇲",
        "aliases": ["gambia", "gm", "🇬🇲"]
    },
    "guinea": {
        "flag": "🇬🇳",
        "aliases": ["guinea", "gn", "🇬🇳"]
    },
    "equatorial guinea": {
        "flag": "🇬🇶",
        "aliases": ["equatorial guinea", "gq", "🇬🇶"]
    },
    "guinea-bissau": {
        "flag": "🇬🇼",
        "aliases": ["guinea-bissau", "gw", "guinea bissau", "🇬🇼"]
    },
    "kenya": {
        "flag": "🇰🇪",
        "aliases": ["kenya", "ke", "🇰🇪"]
    },
    "comoros": {
        "flag": "🇰🇲",
        "aliases": ["comoros", "km", "🇰🇲"]
    },
    "liberia": {
        "flag": "🇱🇷",
        "aliases": ["liberia", "lr", "🇱🇷"]
    },
    "lesotho": {
        "flag": "🇱🇸",
        "aliases": ["lesotho", "ls", "🇱🇸"]
    },
    "libya": {
        "flag": "🇱🇾",
        "aliases": ["libya", "ly", "🇱🇾"]
    },
    "morocco": {
        "flag": "🇲🇦",
        "aliases": ["morocco", "ma", "morroco", "🇲🇦"]
    },
    "madagascar": {
        "flag": "🇲🇬",
        "aliases": ["madagascar", "mg", "🇲🇬"]
    },
    "mali": {
        "flag": "🇲🇱",
        "aliases": ["mali", "ml", "🇲🇱"]
    },
    "mauritania": {
        "flag": "🇲🇷",
        "aliases": ["mauritania", "mr", "🇲🇷"]
    },
    "mauritius": {
        "flag": "🇲🇺",
        "aliases": ["mauritius", "mu", "🇲🇺"]
    },
    "malawi": {
        "flag": "🇲🇼",
        "aliases": ["malawi", "mw", "🇲🇼"]
    },
    "mozambique": {
        "flag": "🇲🇿",
        "aliases": ["mozambique", "mz", "🇲🇿"]
    },
    "namibia": {
        "flag": "🇳🇦",
        "aliases": ["namibia", "na", "🇳🇦"]
    },
    "niger": {
        "flag": "🇳🇪",
        "aliases": ["niger", "ne", "🇳🇪"]
    },
    "nigeria": {
        "flag": "🇳🇬",
        "aliases": ["nigeria", "ng", "🇳🇬"]
    },
    "rwanda": {
        "flag": "🇷🇼",
        "aliases": ["rwanda", "rw", "🇷🇼"]
    },
    "seychelles": {
        "flag": "🇸🇨",
        "aliases": ["seychelles", "sc", "🇸🇨"]
    },
    "sudan": {
        "flag": "🇸🇩",
        "aliases": ["sudan", "sd", "🇸🇩"]
    },
    "sierra leone": {
        "flag": "🇸🇱",
        "aliases": ["sierra leone", "sl", "🇸🇱"]
    },
    "senegal": {
        "flag": "🇸🇳",
        "aliases": ["senegal", "sn", "🇸🇳"]
    },
    "somalia": {
        "flag": "🇸🇴",
        "aliases": ["somalia", "so", "🇸🇴"]
    },
    "south sudan": {
        "flag": "🇸🇸",
        "aliases": ["south sudan", "ss", "🇸🇸"]
    },
    "eswatini": {
        "flag": "🇸🇿",
        "aliases": ["eswatini", "swaziland", "sz", "🇸🇿"]
    },
    "chad": {
        "flag": "🇹🇩",
        "aliases": ["chad", "td", "🇹🇩"]
    },
    "togo": {
        "flag": "🇹🇬",
        "aliases": ["togo", "tg", "🇹🇬"]
    },
    "tunisia": {
        "flag": "🇹🇳",
        "aliases": ["tunisia", "tn", "🇹🇳"]
    },
    "tanzania": {
        "flag": "🇹🇿",
        "aliases": ["tanzania", "tz", "🇹🇿"]
    },
    "uganda": {
        "flag": "🇺🇬",
        "aliases": ["uganda", "ug", "🇺🇬"]
    },
    "south africa": {
        "flag": "🇿🇦",
        "aliases": ["south africa", "za", "🇿🇦"]
    },
    "zambia": {
        "flag": "🇿🇲",
        "aliases": ["zambia", "zm", "🇿🇲"]
    },
    "zimbabwe": {
        "flag": "🇿🇼",
        "aliases": ["zimbabwe", "zw", "🇿🇼"]
    },
    //europe
    "andorra": {
        "flag": "🇦🇩",
        "aliases": ["andorra", "ad", "🇦🇩"]
    },
    "albania": {
        "flag": "🇦🇱",
        "aliases": ["albania", "al", "🇦🇱"]
    },
    "armenia": {
        "flag": "🇦🇲",
        "aliases": ["armenia", "am", "🇦🇲"]
    },
    "austria": {
        "flag": "🇦🇹",
        "aliases": ["austria", "at", "🇦🇹"]
    },
    "bosnia and herzegovina": {
        "flag": "🇧🇦",
        "aliases": ["bosnia and herzegovina", "ba", "bosnia", "🇧🇦"]
    },
    "belgium": {
        "flag": "🇧🇪",
        "aliases": ["belgium", "be", "🇧🇪"]
    },
    "bulgaria": {
        "flag": "🇧🇬",
        "aliases": ["bulgaria", "bg", "🇧🇬"]
    },
    "belarus": {
        "flag": "🇧🇾",
        "aliases": ["belarus", "by", "🇧🇾"]
    },
    "switzerland": {
        "flag": "🇨🇭",
        "aliases": ["switzerland", "ch", "🇨🇭"]
    },
    "cyprus": {
        "flag": "🇨🇾",
        "aliases": ["cyprus", "cy", "🇨🇾"]
    },
    "czech republic": {
        "flag": "🇨🇿",
        "aliases": ["czech republic", "cz", "czechia", "czech", "🇨🇿"]
    },
    "germany": {
        "flag": "🇩🇪",
        "aliases": ["germany", "de", "🇩🇪"]
    },
    "denmark": {
        "flag": "🇩🇰",
        "aliases": ["denmark", "dk", "🇩🇰"]
    },
    "Ceuta & Melilla": {
        "flag": "🇪🇦",
        "aliases": ["Ceuta & Melilla", "ceuta", "ea", "🇪🇦", "ceuta and melilla"]
    },
    "estonia": {
        "flag": "🇪🇪",
        "aliases": ["estonia", "ee", "🇪🇪"]
    },
    "spain": {
        "flag": "🇪🇸",
        "aliases": ["spain", "es", "🇪🇸"]
    },
    "finland": {
        "flag": "🇫🇮",
        "aliases": ["finland", "fi", "🇫🇮"]
    },
    "france": {
        "flag": "🇫🇷",
        "aliases": ["france", "fr", "🇫🇷"]
    },
    "Northern Ireland": {
        "flag": "🇬🇧",
        "aliases": ["Northern Ireland", "🇬🇧", "nir", "NIR"]
    },
    "georgia": {
        "flag": "🇬🇪",
        "aliases": ["georgia", "ge", "🇬🇪"]
    },
    "guernsey": {
        "flag": "🇬🇬",
        "aliases": ["guernsey", "gg", "🇬🇬"]
    },
    "gibraltar": {
        "flag": "🇬🇮",
        "aliases": ["gibraltar", "gi", "🇬🇮"]
    },
    "greece": {
        "flag": "🇬🇷",
        "aliases": ["greece", "gr", "🇬🇷"]
    },
    "croatia": {
        "flag": "🇭🇷",
        "aliases": ["croatia", "hr", "🇭🇷"]
    },
    "hungary": {
        "flag": "🇭🇺",
        "aliases": ["hungary", "hu", "🇭🇺"]
    },
    "ireland": {
        "flag": "🇮🇪",
        "aliases": ["ireland", "ie", "🇮🇪"]
    },
    "isle of man": {
        "flag": "🇮🇲",
        "aliases": ["isle of man", "im", "🇮🇲"]
    },
    "iceland": {
        "flag": "🇮🇸",
        "aliases": ["iceland", "is", "🇮🇸"]
    },
    "italy": {
        "flag": "🇮🇹",
        "aliases": ["italy", "it", "🇮🇹"]
    },
    "jersey": {
        "flag": "🇯🇪",
        "aliases": ["jersey", "je", "🇯🇪"]
    },
    "liechtenstein": {
        "flag": "🇱🇮",
        "aliases": ["liechtenstein", "li", "liech", "🇱🇮"]
    },
    "lithuania": {
        "flag": "🇱🇹",
        "aliases": ["lithuania", "lt", "🇱🇹"]
    },
    "luxembourg": {
        "flag": "🇱🇺",
        "aliases": ["luxembourg", "lu", "🇱🇺"]
    },
    "latvia": {
        "flag": "🇱🇻",
        "aliases": ["latvia", "lv", "🇱🇻"]
    },
    "monaco": {
        "flag": "🇲🇨",
        "aliases": ["monaco", "mc", "🇲🇨"]
    },
    "moldova": {
        "flag": "🇲🇩",
        "aliases": ["moldova", "md", "🇲🇩"]
    },
    "montenegro": {
        "flag": "🇲🇪",
        "aliases": ["montenegro", "me", "🇲🇪"]
    },
    "macedonia": {
        "flag": "🇲🇰",
        "aliases": ["macedonia", "mk", "🇲🇰"]
    },
    "malta": {
        "flag": "🇲🇹",
        "aliases": ["malta", "mt", "🇲🇹"]
    },
    "netherlands": {
        "flag": "🇳🇱",
        "aliases": ["netherlands", "nl", "🇳🇱"]
    },
    "norway": {
        "flag": "🇳🇴",
        "aliases": ["norway", "no", "🇳🇴"]
    },
    "poland": {
        "flag": "🇵🇱",
        "aliases": ["poland", "pl", "🇵🇱"]
    },
    "portugal": {
        "flag": "🇵🇹",
        "aliases": ["portugal", "pt", "🇵🇹"]
    },
    "romania": {
        "flag": "🇷🇴",
        "aliases": ["romania", "ro", "🇷🇴"]
    },
    "serbia": {
        "flag": "🇷🇸",
        "aliases": ["serbia", "rs", "🇷🇸"]
    },
    "russia": {
        "flag": "🇷🇺",
        "aliases": ["russia", "ru", "🇷🇺"]
    },
    "sweden": {
        "flag": "🇸🇪",
        "aliases": ["sweden", "se", "🇸🇪"]
    },
    "slovenia": {
        "flag": "🇸🇮",
        "aliases": ["slovenia", "si", "🇸🇮"]
    },
    "slovakia": {
        "flag": "🇸🇰",
        "aliases": ["slovakia", "sk", "🇸🇰"]
    },
    "san marino": {
        "flag": "🇸🇲",
        "aliases": ["san marino", "sm", "🇸🇲"]
    },
    "ukraine": {
        "flag": "🇺🇦",
        "aliases": ["ukraine", "ua", "🇺🇦"]
    },
    "vatican city": {
        "flag": "🇻🇦",
        "aliases": ["vatican city", "va", "vatican", "🇻🇦"]
    },
    "kosovo": {
        "flag": "🇽🇰",
        "aliases": ["kosovo", "xk", "🇽🇰"]
    },
    "scotland": {
        "flag": ":scotland:",
        "aliases": ["scotland", "sct", ":scotland:"]
    },
    "england": {
        "flag": ":england:",
        "aliases": ["england", "eng", ":england:"]
    },
    "wales": {
        "flag": ":wales:",
        "aliases": ["wales", "wls", ":wales:"]
    },
    "united kingdom": {
        "flag": ":england:",
        "aliases": ["united kingdom", "united kingdom", "uk"]
    },
    //americas
    "antigua and barbuda": {
        "flag": "🇦🇬",
        "aliases": ["antigua and barbuda", "ag", "🇦🇬"]
    },
    "anguilla": {
        "flag": "🇦🇮",
        "aliases": ["anguilla", "ai", "🇦🇮"]
    },
    "argentina": {
        "flag": "🇦🇷",
        "aliases": ["argentina", "ar", "🇦🇷"]
    },
    "aruba": {
        "flag": "🇦🇼",
        "aliases": ["aruba", "aw", "🇦🇼"]
    },
    "barbados": {
        "flag": "🇧🇧",
        "aliases": ["barbados", "bb", "🇧🇧"]
    },
    "saint barthélemy": {
        "flag": "🇧🇱",
        "aliases": ["saint barthélemy", "bl", "saint barthelemy", "🇧🇱"]
    },
    "bermuda": {
        "flag": "🇧🇲",
        "aliases": ["bermuda", "bm", "🇧🇲"]
    },
    "bolivia": {
        "flag": "🇧🇴",
        "aliases": ["bolivia", "bo", "🇧🇴"]
    },
    "caribbean netherlands": {
        "flag": "🇧🇶",
        "aliases": ["caribbean netherlands", "bq", "🇧🇶"]
    },
    "brazil": {
        "flag": "🇧🇷",
        "aliases": ["brazil", "br", "🇧🇷"]
    },
    "bahamas": {
        "flag": "🇧🇸",
        "aliases": ["bahamas", "bs", "🇧🇸"]
    },
    "belize": {
        "flag": "🇧🇿",
        "aliases": ["belize", "bz", "🇧🇿"]
    },
    "canada": {
        "flag": "🇨🇦",
        "aliases": ["canada", "ca", "🇨🇦"]
    },
    "chile": {
        "flag": "🇨🇱",
        "aliases": ["chile", "cl", "🇨🇱"]
    },
    "colombia": {
        "flag": "🇨🇴",
        "aliases": ["colombia", "co", "🇨🇴"]
    },
    "costa rica": {
        "flag": "🇨🇷",
        "aliases": ["costa rica", "cr", "🇨🇷"]
    },
    "cuba": {
        "flag": "🇨🇺",
        "aliases": ["cuba", "cu", "🇨🇺"]
    },
    "curaçao": {
        "flag": "🇨🇼",
        "aliases": ["curaçao", "cw", "curacao", "🇨🇼"]
    },
    "dominica": {
        "flag": "🇩🇲",
        "aliases": ["dominica", "dm", "🇩🇲"]
    },
    "dominican republic": {
        "flag": "🇩🇴",
        "aliases": ["dominican republic", "do", "🇩🇴"]
    },
    "ecuador": {
        "flag": "🇪🇨",
        "aliases": ["ecuador", "ec", "🇪🇨"]
    },
    "falkland islands": {
        "flag": "🇫🇰",
        "aliases": ["falkland islands", "fk", "🇫🇰"]
    },
    "grenada": {
        "flag": "🇬🇩",
        "aliases": ["grenada", "gd", "🇬🇩"]
    },
    "french guiana": {
        "flag": "🇬🇫",
        "aliases": ["french guiana", "gf", "🇬🇫"]
    },
    "guadeloupe": {
        "flag": "🇬🇵",
        "aliases": ["guadeloupe", "gp", "🇬🇵"]
    },
    "guatemala": {
        "flag": "🇬🇹",
        "aliases": ["guatemala", "gt", "🇬🇹"]
    },
    "guyana": {
        "flag": "🇬🇾",
        "aliases": ["guyana", "gy", "🇬🇾"]
    },
    "honduras": {
        "flag": "🇭🇳",
        "aliases": ["honduras", "hn", '🇭🇳']
    },
    "haiti": {
        "flag": "🇭🇹",
        "aliases": ["haiti", "ht", "🇭🇹"]
    },
    "jamaica": {
        "flag": "🇯🇲",
        "aliases": ["jamaica", "jm", "🇯🇲"]
    },
    "saint kitts and nevis": {
        "flag": "🇰🇳",
        "aliases": ["saint kitts and nevis", "kn", "st kitts", "saint kitts", "saint kitts and nevis", "st kitts and nevis", "🇰🇳"]
    },
    "cayman islands": {
        "flag": "🇰🇾",
        "aliases": ["cayman islands", "ky", "🇰🇾"]
    },
    "saint lucia": {
        "flag": "🇱🇨",
        "aliases": ["saint lucia", "lc", "sainte lucia", "ste lucia", "🇱🇨"]
    },
    "saint martin": {
        "flag": "🇲🇫",
        "aliases": ["saint martin", "mf", "🇲🇫"]
    },
    "martinique": {
        "flag": "🇲🇶",
        "aliases": ["martinique", "mq", "🇲🇶"]
    },
    "montserrat": {
        "flag": "🇲🇸",
        "aliases": ["montserrat", "ms", "🇲🇸"]
    },
    "mexico": {
        "flag": "🇲🇽",
        "aliases": ["mexico", "mx", "🇲🇽"]
    },
    "nicaragua": {
        "flag": "🇳🇮",
        "aliases": ["nicaragua", "ni", "🇳🇮"]
    },
    "panama": {
        "flag": "🇵🇦",
        "aliases": ["panama", "pa", "🇵🇦"]
    },
    "peru": {
        "flag": "🇵🇪",
        "aliases": ["peru", "pe", "🇵🇪"]
    },
    "saint pierre and miquelon": {
        "flag": "🇵🇲",
        "aliases": ["saint pierre and miquelon", "pm", "🇵🇲"]
    },
    "puerto rico": {
        "flag": "🇵🇷",
        "aliases": ["puerto rico", "pr", "🇵🇷"]
    },
    "paraguay": {
        "flag": "🇵🇾",
        "aliases": ["paraguay", "py", "🇵🇾"]
    },
    "suriname": {
        "flag": "🇸🇷",
        "aliases": ["suriname", "sr", "🇸🇷"]
    },
    "el salvador": {
        "flag": "🇸🇻",
        "aliases": ["el salvador", "sv", "salvador", "🇸🇻"]
    },
    "sint maarten": {
        "flag": "🇸🇽",
        "aliases": ["sint maarten", "sx", "🇸🇽"]
    },
    "turks and caicos islands": {
        "flag": "🇹🇨",
        "aliases": ["turks and caicos islands", "tc", "🇹🇨"]
    },
    "trinidad and tobago": {
        "flag": "🇹🇹",
        "aliases": ["trinidad and tobago", "tt", "🇹🇹"]
    },
    "united states": {
        "flag": "🇺🇸",
        "aliases": ["united states", "usa", "us", "🇺🇸"]
    },
    "uruguay": {
        "flag": "🇺🇾",
        "aliases": ["uruguay", "uy", "🇺🇾"]
    },
    "venezuela": {
        "flag": "🇻🇪",
        "aliases": ["venezuela", "ve", "🇻🇪"]
    },
    "british virgin islands": {
        "flag": "🇻🇬",
        "aliases": ["british virgin islands", "vg", "🇻🇬"]
    },
    "us virgin islands": {
        "flag": "🇻🇮",
        "aliases": ["us virgin islands", "vi", "usvi", "🇻🇮"]
    },
    //asia
    "united arab emirates": {
        "flag": "🇦🇪",
        "aliases": ["united arab emirates", "ae", "uae", "🇦🇪"]
    },
    "afghanistan": {
        "flag": "🇦🇫",
        "aliases": ["afghanistan", "af", "🇦🇫"]
    },
    "azerbaijan": {
        "flag": "🇦🇿",
        "aliases": ["azerbaijan", "az", "🇦🇿"]
    },
    "bangladesh": {
        "flag": "🇧🇩",
        "aliases": ["bangladesh", "bd", "🇧🇩"]
    },
    "bahrain": {
        "flag": "🇧🇭",
        "aliases": ["bahrain", "bh", "🇧🇭"]
    },
    "brunei": {
        "flag": "🇧🇳",
        "aliases": ["brunei", "bn", "🇧🇳"]
    },
    "bhutan": {
        "flag": "🇧🇹",
        "aliases": ["bhutan", "bt", "🇧🇹"]
    },
    "china": {
        "flag": "🇨🇳",
        "aliases": ["china", "cn", "🇨🇳"]
    },
    "hong kong": {
        "flag": "🇭🇰",
        "aliases": ["hong kong", "hk", "🇭🇰"]
    },
    "indonesia": {
        "flag": "🇮🇩",
        "aliases": ["indonesia", "id", "🇮🇩"]
    },
    "israel": {
        "flag": "🇮🇱",
        "aliases": ["israel", "il", "🇮🇱"]
    },
    "india": {
        "flag": "🇮🇳",
        "aliases": ["india", "in", "🇮🇳"]
    },
    "iraq": {
        "flag": "🇮🇶",
        "aliases": ["iraq", "iq", "🇮🇶"]
    },
    "iran": {
        "flag": "🇮🇷",
        "aliases": ["iran", "ir", "🇮🇷"]
    },
    "jordan": {
        "flag": "🇯🇴",
        "aliases": ["jordan", "jo", "🇯🇴"]
    },
    "japan": {
        "flag": "🇯🇵",
        "aliases": ["japan", "jp", "🇯🇵"]
    },
    "kyrgyzstan": {
        "flag": "🇰🇬",
        "aliases": ["kyrgyzstan", "kg", "🇰🇬"]
    },
    "cambodia": {
        "flag": "🇰🇭",
        "aliases": ["cambodia", "kh", "🇰🇭"]
    },
    "north korea": {
        "flag": "🇰🇵",
        "aliases": ["north korea", "kp", "🇰🇵"]
    },
    "south korea": {
        "flag": "🇰🇷",
        "aliases": ["south korea", "kr", "🇰🇷"]
    },
    "kuwait": {
        "flag": "🇰🇼",
        "aliases": ["kuwait", "kw", "🇰🇼"]
    },
    "kazakhstan": {
        "flag": "🇰🇿",
        "aliases": ["kazakhstan", "kz", "🇰🇿"]
    },
    "laos": {
        "flag": "🇱🇦",
        "aliases": ["laos", "la", "🇱🇦"]
    },
    "lebanon": {
        "flag": "🇱🇧",
        "aliases": ["lebanon", "lb", "🇱🇧"]
    },
    "sri lanka": {
        "flag": "🇱🇰",
        "aliases": ["sri lanka", "lk", "🇱🇰"]
    },
    "myanmar": {
        "flag": "🇲🇲",
        "aliases": ["myanmar", "mm", "🇲🇲"]
    },
    "mongolia": {
        "flag": "🇲🇳",
        "aliases": ["mongolia", "mn", "🇲🇳"]
    },
    "macau": {
        "flag": "🇲🇴",
        "aliases": ["macau", "mo", "🇲🇴"]
    },
    "maldives": {
        "flag": "🇲🇻",
        "aliases": ["maldives", "mv", "🇲🇻"]
    },
    "malaysia": {
        "flag": "🇲🇾",
        "aliases": ["malaysia", "my", "🇲🇾"]
    },
    "nepal": {
        "flag": "🇳🇵",
        "aliases": ["nepal", "np", "🇳🇵"]
    },
    "oman": {
        "flag": "🇴🇲",
        "aliases": ["oman", "om", "🇴🇲"]
    },
    "philippines": {
        "flag": "🇵🇭",
        "aliases": ["philippines", "ph", "🇵🇭"]
    },
    "pakistan": {
        "flag": "🇵🇰",
        "aliases": ["pakistan", "pk", "🇵🇰"]
    },
    "palestine": {
        "flag": "🇵🇸",
        "aliases": ["palestine", "ps", "🇵🇸"]
    },
    "qatar": {
        "flag": "🇶🇦",
        "aliases": ["qatar", "qa", "🇶🇦"]
    },
    "russia": {
        "flag": "🇷🇺",
        "aliases": ["russia", "ru", "🇷🇺"]
    },
    "saudi arabia": {
        "flag": "🇸🇦",
        "aliases": ["saudi arabia", "sa", "🇸🇦"]
    },
    "singapore": {
        "flag": "🇸🇬",
        "aliases": ["singapore", "sg", "🇸🇬"]
    },
    "syria": {
        "flag": "🇸🇾",
        "aliases": ["syria", "sy", "🇸🇾"]
    },
    "thailand": {
        "flag": "🇹🇭",
        "aliases": ["thailand", "th", "🇹🇭"]
    },
    "tajikistan": {
        "flag": "🇹🇯",
        "aliases": ["tajikistan", "tj", "🇹🇯"]
    },
    "timor-leste": {
        "flag": "🇹🇱",
        "aliases": ["timor-leste", "tl", "🇹🇱", "timor", "timor leste"]
    },
    "turkmenistan": {
        "flag": "🇹🇲",
        "aliases": ["turkmenistan", "tm", "🇹🇲"]
    },
    "turkey": {
        "flag": "🇹🇷",
        "aliases": ["turkey", "tr", "turkiye", "🇹🇷"]
    },
    "taiwan": {
        "flag": "🇹🇼",
        "aliases": ["taiwan", "tw", "🇹🇼"]
    },
    "uzbekistan": {
        "flag": "🇺🇿",
        "aliases": ["uzbekistan", "uz", "🇺🇿"]
    },
    "vietnam": {
        "flag": "🇻🇳",
        "aliases": ["vietnam", "vn", "🇻🇳"]
    },
    "yemen": {
        "flag": "🇾🇪",
        "aliases": ["yemen", "ye", "🇾🇪"]
    },
    //oceania
    "ascension island": {
        "flag": "🇦🇨",
        "aliases": ["ascension island", "ac", "🇦🇨", "ascension"]
    },
    "antarctica": {
        "flag": "🇦🇶",
        "aliases": ["antarctica", "aq", "🇦🇶"]
    },
    "american samoa": {
        "flag": "🇦🇸",
        "aliases": ["american samoa", "as", "🇦🇸"]
    },
    "australia": {
        "flag": "🇦🇺",
        "aliases": ["australia", "au", "🇦🇺"]
    },
    "aland islands": {
        "flag": "🇦🇽",
        "aliases": ["aland islands", "ax", "🇦🇽", "aaland", "aland", "aaland islands"]
    },
    "bouvet island": {
        "flag": "🇧🇻",
        "aliases": ["bouvet island", "bv", "🇧🇻", "bouvet"]
    },
    "cocos islands": {
        "flag": "🇨🇨",
        "aliases": ["cocos islands", "cc", "🇨🇨", "cocos"]
    },
    "cook islands": {
        "flag": "🇨🇰",
        "aliases": ["cook islands", "ck", "🇨🇰", "cook"]
    },
    "clipperton island": {
        "flag": "🇨🇵",
        "aliases": ["clipperton", "clipperton island", "cp", "🇨🇵"]
    },
    "christmas island": {
        "flag": "🇨🇽",
        "aliases": ["christmas island", "cx", "🇨🇽"]
    },
    "diego garcia": {
        "flag": "🇩🇬",
        "aliases": ["diego garcia", "dg", "🇩🇬"]
    },
    "fiji": {
        "flag": "🇫🇯",
        "aliases": ["fiji", "fj", "🇫🇯"]
    },
    "micronesia": {
        "flag": "🇫🇲",
        "aliases": ["micronesia", "fm", "🇫🇲"]
    },
    "greenland": {
        "flag": "🇬🇱",
        "aliases": ["greenland", "gl", "🇬🇱"]
    },
    "south georgia and south sandwich islands": {
        "flag": "🇬🇸",
        "aliases": ["south georgia and south sandwich islands", "gs", "🇬🇸", "south georgia"]
    },
    "guam": {
        "flag": "🇬🇺",
        "aliases": ["guam", "gu", "🇬🇺"]
    },
    "heard island and mcdonald islands": {
        "flag": "🇭🇲",
        "aliases": ["heard island and mcdonald islands", "hm", "🇭🇲", "heard island"]
    },
    "canary islands": {
        "flag": "🇮🇨",
        "aliases": ["canary islands", "ic", "🇮🇨", "canary"]
    },
    "british indian ocean territory": {
        "flag": "🇮🇴",
        "aliases": ["british indian ocean territory", "io", "🇮🇴"]
    },
    "kiribati": {
        "flag": "🇰🇮",
        "aliases": ["kiribati", "ki", "🇰🇮"]
    },
    "marshall islands": {
        "flag": "🇲🇭",
        "aliases": ["marshall islands", "mh", "🇲🇭", 'marshall']
    },
    "northern mariana islands": {
        "flag": "🇲🇵",
        "aliases": ["northern mariana islands", "mp", "🇲🇵", "nmi"]
    },
    "new caledonia": {
        "flag": "🇳🇨",
        "aliases": ["new caledonia", "nc", "🇳🇨"]
    },
    "norfolk island": {
        "flag": "🇳🇫",
        "aliases": ["norfolk island", "nf", "🇳🇫", "norfolk"]
    },
    "nauru": {
        "flag": "🇳🇷",
        "aliases": ["nauru", "nr", "🇳🇷"]
    },
    "niue": {
        "flag": "🇳🇺",
        "aliases": ["niue", "nu", "🇳🇺"]
    },
    "new zealand": {
        "flag": "🇳🇿",
        "aliases": ["new zealand", "nz", "🇳🇿"]
    },
    "french polynesia": {
        "flag": "🇵🇫",
        "aliases": ["french polynesia", "pf", "🇵🇫"]
    },
    "papua new guinea": {
        "flag": "🇵🇬",
        "aliases": ["papua new guinea", "pg", "🇵🇬", "png"]
    },
    "pitcairn islands": {
        "flag": "🇵🇳",
        "aliases": ["pitcairn islands", "pn", "🇵🇳"]
    },
    "palau": {
        "flag": "🇵🇼",
        "aliases": ["palau", "pw", "🇵🇼"]
    },
    "reunion": {
        "flag": "🇷🇪",
        "aliases": ["reunion", "re", "🇷🇪"]
    },
    "solomon islands": {
        "flag": "🇸🇧",
        "aliases": ["solomon islands", "sb", "🇸🇧", "solomon"]
    },
    "saint helena": {
        "flag": "🇸🇭",
        "aliases": ["saint helena", "sh", "🇸🇭"]
    },
    "svalbard and jan mayen": {
        "flag": "🇸🇯",
        "aliases": ["svalbard and jan mayen", "sj", "🇸🇯", "svalbard"]
    },
    "sao tome and principe": {
        "flag": "🇸🇹",
        "aliases": ["sao tome and principe", "st", "🇸🇹"]
    },
    "tristan da cunha": {
        "flag": "🇹🇦",
        "aliases": ["tristan da cunha", "ta", "🇹🇦"]
    },
    "french southern territories": {
        "flag": "🇹🇫",
        "aliases": ["french southern territories", "tf", "🇹🇫", "taaf"]
    },
    "tokelau": {
        "flag": "🇹🇰",
        "aliases": ["tokelau", "tk", "🇹🇰"]
    },
    "tonga": {
        "flag": "🇹🇴",
        "aliases": ["tonga", "to", "🇹🇴"]
    },
    "tuvalu": {
        "flag": "🇹🇻",
        "aliases": ["tuvalu", "tv", "🇹🇻"]
    },
    "US Outlying Islands": {
        "flag": "🇺🇲",
        "aliases": ["US Outlying Islands", "Outlying Islands", "um", "🇺🇲", "united states Outlying Islands"]
    },
    "saint vincent and the grenadines": {
        "flag": "🇻🇨",
        "aliases": ["saint vincent and the grenadines", "vc", "saint vincent", "🇻🇨"]
    },
    "vanuatu": {
        "flag": "🇻🇺",
        "aliases": ["vanuatu", "vu", "🇻🇺"]
    },
    "wallis and futuna": {
        "flag": "🇼🇫",
        "aliases": ["wallis and futuna", "wf", "🇼🇫"]
    },
    "samoa": {
        "flag": "🇼🇸",
        "aliases": ["samoa", "ws", "🇼🇸"]
    },
    "mayotte": {
        "flag": "🇾🇹",
        "aliases": ["mayotte", "yt", "🇾🇹"]
    }
}

const availableMapNames = [
  "A Balanced World",
  "An Arbitrary World",
  "A Pro World",
  "An Arbitrary Rural World"
];


const maps = {};
availableMapNames.forEach(name => {
  maps[name] = name.toLowerCase().replace(/\s+/g, '-');
});
const mapAliases = {
  abw: "A Balanced World",
  "a balanced world": "A Balanced World",

  aaw: "An Arbitrary World",
  "an arbitrary world": "An Arbitrary World",

  apw: "A Pro World",
  "a pro world": "A Pro World",

  aarw: "An Arbitrary Rural World",
  "an arbitrary rural world": "An Arbitrary Rural World",

};
async function initializeResources() {
  console.log("Initialisation des ressources en cours...");
  
  try {
    await getBrowser();
    console.log("navigateur initialisé");
    
    if (typeof preloadLocationCache === 'function') {
      await preloadLocationCache();
      console.log("Cache d'emplacements préchargée");
    } else {
      console.log("La fonction preloadLocationCache n'est pas disponible, ignoré");
    }
    
    console.log("Resources initialized and ready for fast quiz generation");
    return true;
  } catch (error) {
    console.error("Erreur lors de l'initialisation des ressources:", error);
    return false;
  }
}

function resolveMapName(input) {
  if (!input) return null;
  return mapAliases[input.toLowerCase()] || null;
}

let browserPool = null;
let isInitializingBrowser = false;
const MAX_BROWSER_AGE = 10 * 60 * 1000; // 30 mins
let browserStartTime = null;
let browserPage = null;
const locationCache = {};
if (typeof quizzesByChannel === 'undefined') var quizzesByChannel = {};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const COUNTRIES = {};

Object.keys(COUNTRIES_DATA).forEach(country => {
    COUNTRIES[country] = COUNTRIES_DATA[country];
});

const COUNTRY_LOOKUP = {};
Object.keys(COUNTRIES).forEach(country => {
  COUNTRY_LOOKUP[country.toLowerCase()] = country;
  COUNTRIES[country].aliases.forEach(alias => {
    COUNTRY_LOOKUP[alias.toLowerCase()] = country;
  });
});



function loadJsonFile(filePath, defaultValue = {}) {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
    return defaultValue;
  } catch (error) {
    console.error(`Error loading file ${filePath}:`, error);
    return defaultValue;
  }
}

function saveJsonFile(filePath, data) {
  try {
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error saving to ${filePath}:`, error);
  }
}

let personalBestStreaks = loadJsonFile(PB_STREAK_PATH, {});
let leaderboardStreaks = loadJsonFile(LB_STREAK_PATH, {});

async function initializeBrowser() {
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--mute-audio',
        '--safebrowsing-disable-auto-update'
      ]
    });
    browserPool = browser;
    browserStartTime = Date.now();
    console.log('Browser initialized successfully');
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    return page;
  } catch (error) {
    console.error(`Error initializing browser: ${error.message}`);
    browserPool = null;
  }
}

async function getBrowser() {
  if (isInitializingBrowser) {
    while (isInitializingBrowser) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return browserPool;
  }

  const expired = !browserPool || (Date.now() - browserStartTime > MAX_BROWSER_AGE);
  if (expired) {
    isInitializingBrowser = true;

    if (browserPool) {
      try {
        await browserPool.close();
        browserPage = null;
      } catch (err) {
        console.error("Error closing old browser:", err);
      }
    }

    try {
      browserPool = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions'
        ]
      });
      browserStartTime = Date.now();
      console.log("Browser launched.");
      
      browserPage = await browserPool.newPage();
      await browserPage.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
      
    } catch (err) {
      console.error("Failed to launch browser:", err);
      browserPool = null;
    }

    isInitializingBrowser = false;
  }

  return browserPool;
}



function normalizeCountry(countryName) {
  const lookupKey = countryName.toLowerCase();
  if (COUNTRY_LOOKUP[lookupKey]) {
    return COUNTRY_LOOKUP[lookupKey];
  }
  
  for (const key of Object.keys(COUNTRY_LOOKUP)) {
    if (lookupKey.includes(key) || key.includes(lookupKey)) {
      return COUNTRY_LOOKUP[key];
    }
  }
  
  return null;
}

async function getCountryFromCoordinates(lat, lng) {
  const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;

  if (locationCache[cacheKey]) {
    return locationCache[cacheKey];
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=5&addressdetails=1`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'GeoBot/1.0',
        'Accept-Language': 'en'
      }
    });

    const address = response.data?.address;
    let country = address?.country;
    let subdivision =
      address?.state ||
      address?.province ||
      address?.region ||
      address?.territory ||
      address?.state_district ||
      address?.county ||
      address?.administrative ||
      address?.municipality ||
      address?.district ||
      address?.city ||
      address?.town ||
      address?.village ||
      address?.locality ||
      address?.borough ||
      address?.suburb ||
      address?.neighbourhood ||
      address?.hamlet ||
      address?.ISO3166_2_lvl4 ||
      address?.ISO3166_2_lvl6 ||
      address?.political ||
      'Unknown subdivision';

    if (country === 'United States') {
      if (subdivision.toLowerCase().includes('us virgin islands')) country = 'us virgin islands';
      else if (subdivision.toLowerCase().includes('puerto rico')) country = 'puerto rico';
      else if (subdivision.toLowerCase().includes('guam')) country = 'guam';
      else if (subdivision.toLowerCase().includes('american samoa')) country = 'american samoa';
      else if (subdivision.toLowerCase().includes('northern mariana islands')) country = 'northern mariana islands';
    }

    const result = {
      country: country?.toLowerCase() || 'unknown location',
      subdivision: subdivision || 'Unknown subdivision'
    };

    locationCache[cacheKey] = result;
    return result;
  } catch (error) {
    console.error('Error with Nominatim API:', error);
    return { country: 'error', subdivision: 'unknown' };
  }
}



function getWorldGuessrEmbedUrl(location) {
  if (!location) return null;

  const baseUrl = 'https://www.worldguessr.com/svEmbed';
  const params = new URLSearchParams({
    nm: 'true',
    npz: 'false',
    showRoadLabels: 'false',
    lat: location.lat,
    long: location.lng,
    showAnswer: 'false'
  });

  if (location.heading !== undefined) params.append('heading', location.heading);
  if (location.pitch !== undefined) params.append('pitch', location.pitch);
  if (location.zoom !== undefined) params.append('zoom', location.zoom);

  return `${baseUrl}?${params.toString()}`;
}


async function fetchMapLocations(mapName) {
  const slug = maps[mapName];
  if (!slug) throw new Error(`Unknown map name: ${mapName}`);

  const url = `https://api.worldguessr.com/mapLocations/${slug}`;

  if (locationCache[slug]) return locationCache[slug];

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch map: ${mapName}`);

  const data = await res.json();
  if (!data.ready || !Array.isArray(data.locations)) {
    throw new Error(`Map "${mapName}" is not ready or contains no locations.`);
  }

  locationCache[slug] = data.locations;
  return data.locations;
}

async function preloadLocationCache() {
  console.log("Preloading known locations...");

  for (const mapName of availableMapNames) {
    try {
      const locations = await fetchMapLocations(mapName);
      for (const location of locations) {
        const cacheKey = `${location.lat.toFixed(6)},${location.lng.toFixed(6)}`;
        
        if (!locationCache[cacheKey]) {
          try {
            const locationInfo = await getCountryFromCoordinates(location.lat, location.lng);
            if (locationInfo && locationInfo.country) {
              locationCache[cacheKey] = {
                country: locationInfo.country,
                subdivision: locationInfo.subdivision
              };
            }
          } catch (e) {
            console.error(`Error preloading cache for ${cacheKey}:`, e);
          }
        }
      }
    } catch (e) {
      console.error(`Error loading map ${mapName}:`, e);
    }
  }

  console.log(`Location cache preloaded with ${Object.keys(locationCache).length} entries`);
}



async function takeScreenshot(url, channelId) {
  let page;
  let newPageCreated = false;

  try {
    const browser = await getBrowser();
    
    page = await browser.newPage();
    newPageCreated = true;
    
    await page.setViewport({ 
      width: 1280, 
      height: 720,
      deviceScaleFactor: 1
    });

    const pageTimeout = setTimeout(() => {
      console.log("Global timeout exceeded, attempting screenshot anyway");
    }, 3000);
    
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    
    await page.evaluateOnNewDocument(() => {
      window._resourcesLoaded = false;
      window._canvasReady = false;
      
      const originalRequestAnimationFrame = window.requestAnimationFrame;
      window.requestAnimationFrame = function(callback) {
        window._canvasReady = true;
        return originalRequestAnimationFrame(callback);
      };
    });
    
    console.log(`Navigating to URL: ${url} for channel ${channelId}`);
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 10000
    });
    
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.mouse.move(650, 360, { steps: 2 });
    await page.mouse.up();
    
    try {
      await page.waitForFunction(() => {
        const canvas = document.querySelector('canvas');
        return canvas && canvas.offsetWidth > 0;
      }, { timeout: 5000 });
    } catch (e) {
      console.log("No canvas found, attempting to capture anyway");
    }
    
    const startTime = Date.now();
    let canProceed = false;
    
    while (!canProceed && (Date.now() - startTime < 3000)) {
      canProceed = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return false;
        
        try {
          const ctx = canvas.getContext('2d');
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          
          let nonBlackPixels = 0;
          for (let i = 0; i < data.length; i += 30000) {
            if (data[i] > 20 || data[i+1] > 20 || data[i+2] > 20) nonBlackPixels++;
            if (nonBlackPixels > 3) return true;
          }
          
          return false;
        } catch(e) {
          return window._canvasReady;
        }
      });
      
      if (!canProceed) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    clearTimeout(pageTimeout);
    
    const screenshotBuffer = await page.screenshot({
      fullPage: false,
      clip: {
        x: 0,
        y: -3,
        width: 1280,
        height: 720
      }
    });
    
    const optimizedBuffer = await sharp(screenshotBuffer)
      .resize(1280, 715)
      .jpeg({ quality: 65 })
      .toBuffer();
    
    return optimizedBuffer;
  } catch (error) {
    console.error(`Error taking screenshot for channel ${channelId}: ${error.message}`);
    throw error;
  } finally {
    if (page && newPageCreated) {
      try {
        await page.close();
      } catch (err) {
        console.error("Error closing page:", err);
      }
    }
  }
}


function checkCountryGuess(guess, correctCountry) {
  if (!guess || !correctCountry) return false;

  const normalizedGuess = guess.toLowerCase();
  const normalizedCorrect = correctCountry.toLowerCase();

  if (normalizedGuess === normalizedCorrect) return true;

  const countryKey = normalizeCountry(normalizedCorrect);

  if (countryKey && COUNTRIES[countryKey]) {
    return COUNTRIES[countryKey].aliases.some(alias =>
      alias.toLowerCase() === normalizedGuess
    );
  }

  return normalizedGuess === normalizedCorrect;
}


function isChannelAllowedForQuiz(channel) {
  if (channel.id === QUIZ_CHANNEL_ID) return true;
  
  if (channel.isThread() && channel.parentId === QUIZ_CHANNEL_ID) return true;
  
  return false;
}

async function startQuiz(channel, mapName = null, userId = null) {
  if (!isChannelAllowedForQuiz(channel)) {
    await channel.send("Quizzes can only be played in the designated channel or its threads.");
    return;
  }

  try {
    const mapNames = availableMapNames;
    let selectedMapName = null;

    if (mapName) {
      selectedMapName = resolveMapName(mapName);
      if (!selectedMapName || !mapNames.includes(selectedMapName)) {
        await channel.send(`Map "${mapName}" not found.\nAvailable maps: ${mapNames.join(', ')}`);
        return;
      }
    } else {
      selectedMapName = mapNames[Math.floor(Math.random() * mapNames.length)];
    }

    const loadingMessage = await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('🌍 Loading Quiz...')
        .setDescription('Preparing your challenge, please wait...')
        .setColor('#3498db')]
    });

    const currentStreak = quizzesByChannel[channel.id]?.currentStreak || 0;
    quizzesByChannel[channel.id] = {
      message: null,
      startTime: Date.now(),
      solved: false,
      mapName: selectedMapName,
      currentStreak: currentStreak,
      participants: [],
      startedBy: userId,
      location: null,
      country: null
    };

    const mapLocations = await fetchMapLocations(selectedMapName);
    if (!mapLocations || mapLocations.length === 0) {
      await loadingMessage.delete().catch(e => console.error("Couldn't delete loading message:", e));
      await channel.send("Could not fetch locations for this map.");
      return;
    }

    const location = mapLocations[Math.floor(Math.random() * mapLocations.length)];
    quizzesByChannel[channel.id].location = location;

    const embedUrl = getWorldGuessrEmbedUrl(location);
    if (!embedUrl) {
      await loadingMessage.delete().catch(e => console.error("Couldn't delete loading message:", e));
      await channel.send("Error generating quiz location.");
      return;
    }

    const [screenshotBuffer, locationInfo] = await Promise.all([
      takeScreenshot(embedUrl, channel.id),
      getCountryFromCoordinates(location.lat, location.lng)
    ]);

    if (!locationInfo || !locationInfo.country) {
      await loadingMessage.delete().catch(e => console.error("Couldn't delete loading message:", e));
      await channel.send("Error fetching country for the location.");
      return;
    }

    quizzesByChannel[channel.id].country = locationInfo.country;
    quizzesByChannel[channel.id].subdivision = locationInfo.subdivision;


    const attachment = new AttachmentBuilder(screenshotBuffer, { name: 'quiz_location.jpg' });

    const embed = new EmbedBuilder()
      .setTitle(`🌍 Country streak – ${selectedMapName}`)
      .setDescription('In which country is this location? Use `!g <country>` to guess!')
      .setImage('attachment://quiz_location.jpg')
      .setColor('#3498db')
      .setFooter({ text: `Map: ${selectedMapName} | Current Streak: ${currentStreak}` });

    const quizMessage = await channel.send({ embeds: [embed], files: [attachment] });
    quizzesByChannel[channel.id].message = quizMessage;

    await loadingMessage.delete().catch(e => console.error("Couldn't delete loading message:", e));

    console.log(`New quiz started in channel ${channel.id}. Map: ${selectedMapName}, Answer: ${locationInfo.country}`);
  } catch (error) {
    console.error(`Error starting quiz: ${error.message}`);
    await channel.send("An error occurred while creating the quiz. Please do !stop, and try again.");
  }
}

async function handleGuess(message, guess) {
  if (!guess.toLowerCase().startsWith('!g ')) return;

  const channelId = message.channel.id;
  const quiz = quizzesByChannel[channelId];
  if (!quiz || quiz.solved) return;

  const subdivision = quiz.subdivision || 'Unknown subdivision';

  if (!quiz.participants.some(p => p.id === message.author.id)) {
    quiz.participants.push({ id: message.author.id, username: message.author.username });
  }

  const parts = guess.trim().split(' ');
  if (parts.length < 2) return;

  const actualGuess = parts.slice(1).join(' ').trim();
  if (!actualGuess) return;

  const correctCountry = quiz.country;
  if (!correctCountry) return;

  const isCorrect = checkCountryGuess(actualGuess, correctCountry);
  const { lat, lng } = quiz.location;

  if (isCorrect) {
    quiz.solved = true;
    quiz.currentStreak++;
    
    const userId = message.author.id;
    const username = message.author.username;
    const mapName = quiz.mapName;
    const quizTime = Date.now() - quiz.startTime;
    
    if (!personalBestStreaks[userId]) {
      personalBestStreaks[userId] = {};
    }
    
    if (!personalBestStreaks[userId][mapName]) {
      personalBestStreaks[userId][mapName] = {
        streak: quiz.currentStreak,
        totalTime: quizTime,
        lastUpdate: Date.now(),
        username: username
      };
    } else if (quiz.currentStreak > personalBestStreaks[userId][mapName].streak) {
      personalBestStreaks[userId][mapName] = {
        streak: quiz.currentStreak,
        totalTime: quizTime,
        lastUpdate: Date.now(),
        username: username
      };
    }
    
    if (!leaderboardStreaks[mapName]) {
      leaderboardStreaks[mapName] = [];
    }

    const userIndex = leaderboardStreaks[mapName].findIndex(entry => entry.userId === userId);
    
    const leaderboardEntry = {
      userId: userId,
      username: username,
      streak: quiz.currentStreak,
      totalTime: quizTime,
      lastUpdate: Date.now()
    };
    
    if (userIndex === -1) {
      leaderboardStreaks[mapName].push(leaderboardEntry);
    } else if (quiz.currentStreak > leaderboardStreaks[mapName][userIndex].streak) {
      leaderboardStreaks[mapName][userIndex] = leaderboardEntry;
    }
    
    leaderboardStreaks[mapName].sort((a, b) => {
      if (b.streak !== a.streak) {
        return b.streak - a.streak;
      }
      return a.totalTime - b.totalTime;
    });
    
    saveJsonFile(PB_STREAK_PATH, personalBestStreaks);
    saveJsonFile(LB_STREAK_PATH, leaderboardStreaks);

    const formattedTime = formatTime(quizTime);

    const countryInfo = COUNTRIES[correctCountry.toLowerCase()] ||
      COUNTRIES[normalizeCountry(correctCountry.toLowerCase())];
    const flag = countryInfo?.flag || '';

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${flag} Correct!`)
          .setDescription(`You guessed it right! The location is in **${correctCountry}**.`)
          .addFields(
            { name: 'Subdivision', value: `**${subdivision}**`, inline: true },
            { name: 'Current Streak', value: `${quiz.currentStreak}`, inline: true },
            {
              name: "Exact Location",
              value: `[Click here to view on Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}&heading=0&pitch=0)`
            }
          )
          .setColor('#2ecc71')
      ]
    });

    quizzesByChannel[channelId] = {
      message: quiz.message,
      startTime: Date.now(),
      solved: true,
      mapName: quiz.mapName,
      currentStreak: quiz.currentStreak,
      participants: [],
      startedBy: quiz.startedBy,
      location: quiz.location,
      country: correctCountry,
      subdivision: quiz.subdivision
    };

    setTimeout(async () => {
      await startQuiz(message.channel, quiz.mapName, message.author.id);
    }, 300);

  } else {
    const countryInfo = COUNTRIES[correctCountry.toLowerCase()] ||
      COUNTRIES[normalizeCountry(correctCountry.toLowerCase())];
    const flag = countryInfo?.flag || '';

    const quizTime = Date.now() - quiz.startTime;
    const formattedTime = formatTime(quizTime);
    const personalBest = personalBestStreaks[message.author.id]?.[quiz.mapName]?.streak || 0;

    const participantsList = quiz.participants.length > 0
      ? quiz.participants.map(p => p.username).join(', ')
      : 'None';

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Game Over!')
          .setDescription(`Wrong guess! The correct answer was **${correctCountry}** ${flag}.`)
          .addFields(
            { name: 'Subdivision', value: `**${subdivision}**`, inline: true },
            { name: 'Total Time Played', value: formattedTime, inline: true },
            { name: 'Final Streak', value: `${quiz.currentStreak}`, inline: true },
            { name: 'Personal Best', value: `${personalBest}`, inline: true },
            { name: 'Participants', value: participantsList, inline: false },
            {
              name: "Exact Location",
              value: `[Click here to view on Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}&heading=0&pitch=0)`
            }
          )
          .setColor('#e74c3c')
      ]
    });
    quizzesByChannel[channelId] = {
      message: null,
      startTime: Date.now(),
      solved: true,
      mapName: quiz.mapName,
      currentStreak: 0,
      participants: [],
      startedBy: quiz.startedBy,
      location: null,
      country: null,
      subdivision: null
    };
  }
}



function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ms = Math.floor((milliseconds % 1000) / 10);
  
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

async function createPrivateThread(interaction, userId) {
  try {
    if (interaction.deferred || interaction.replied) {
      console.log('Interaction already acknowledged');
      return;
    }
    
    await interaction.deferReply({ ephemeral: true });
  
    const quizChannel = await client.channels.fetch(QUIZ_CHANNEL_ID);
    if (!quizChannel) {
      return interaction.editReply({ content: 'Quiz channel not found!', ephemeral: true });
    }
    
    const threadName = `🏁 Private Quiz - ${interaction.user.username}`;
    const thread = await quizChannel.threads.create({
      name: threadName,
      type: ChannelType.PrivateThread,
      reason: `Private session for ${interaction.user.username}`
    });
    
    await thread.members.add(userId);
    const announcementChannelId = '1273947708356431933';
    const announcementChannel = await client.channels.fetch(announcementChannelId);

    if (announcementChannel && announcementChannel.isTextBased()) {
      await announcementChannel.send(`🧵 A new private thread was created by <@${userId}>!\nJoin it here: <https://discord.com/channels/${interaction.guild.id}/${thread.id}>`);
    }
    
    scheduleThreadInactivityCheck(thread.id);
    
    await thread.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('🌍 Welcome to Your Private Session!')
          .setDescription('This is a private thread where you can play without interruptions. You can invite others using `!invite @user`.')
          .addFields(
            { name: 'Starting a Game', value: 'Use `!play <map>` to begin', inline: false },
            { name: 'Inviting Others', value: 'Use `!invite @user` to add friends', inline: false },
            { name: 'Kicking Users', value: 'Use `!kick @user` kick the user', inline: false }
          )
          .setColor('#3498db')
      ]
    });
    
    return interaction.editReply({ 
      content: `Your private quiz thread has been created! [Join thread](https://discord.com/channels/${interaction.guild.id}/${thread.id})`, 
      ephemeral: true 
    });
  } catch (error) {
    console.error('Error creating thread:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ 
        content: 'There was an error creating your private thread. Please try again later.', 
        ephemeral: true 
      });
    } else {
      return interaction.editReply({ 
        content: 'There was an error creating your private thread. Please try again later.', 
        ephemeral: true 
      });
    }
  }
}

function scheduleThreadInactivityCheck(threadId) {
  setTimeout(async () => {
    try {
      const thread = await client.channels.fetch(threadId);
      if (thread && thread.isThread() && !thread.archived) {
        const lastMessage = await thread.messages.fetch({ limit: 1 });
        const lastActivity = lastMessage.first()?.createdTimestamp || thread.createdTimestamp;
        const now = Date.now();
        const hoursInactive = (now - lastActivity) / (1000 * 60 * 60);

        if (hoursInactive >= 24) {
          await thread.delete(`Thread inactive for over 24h`);
          console.log(`Deleted inactive thread: ${thread.name}`);
        } else {
          const remainingTimeMs = (24 - hoursInactive) * 60 * 60 * 1000;
          scheduleThreadInactivityCheck(threadId);
        }
      }
    } catch (err) {
      console.error(`Error checking or deleting thread ${threadId}:`, err);
    }
  }, 24 * 60 * 60 * 1000);
}

async function checkAllQuizThreadsForInactivity() {
  try {
    const quizChannel = await client.channels.fetch(QUIZ_CHANNEL_ID);
    if (!quizChannel) {
      console.error('Quiz channel not found!');
      return;
    }
    
    const threads = await quizChannel.threads.fetchActive();
    
    threads.threads.forEach(async (thread) => {
      try {
        if (thread.isThread() && !thread.archived) {
          const lastMessage = await thread.messages.fetch({ limit: 1 });
          const lastActivity = lastMessage.first()?.createdTimestamp || thread.createdTimestamp;
          const now = Date.now();
          const hoursInactive = (now - lastActivity) / (1000 * 60 * 60);

          if (hoursInactive >= 24) {
            await thread.delete(`Thread inactive for over 24h`);
            console.log(`Deleted inactive thread: ${thread.name}`);
          } else {
            scheduleThreadInactivityCheck(thread.id);
          }
        }
      } catch (err) {
        console.error(`Error checking thread ${thread.id}:`, err);
      }
    });
    
    const archivedThreads = await quizChannel.threads.fetchArchived();
    
    archivedThreads.threads.forEach(async (thread) => {
      try {
        const lastMessage = await thread.messages.fetch({ limit: 1 });
        const lastActivity = lastMessage.first()?.createdTimestamp || thread.createdTimestamp;
        const now = Date.now();
        const hoursInactive = (now - lastActivity) / (1000 * 60 * 60);

        if (hoursInactive >= 24) {
          await thread.delete(`Thread inactive for over 24h`);
          console.log(`Deleted inactive thread: ${thread.name}`);
        }
      } catch (err) {
        console.error(`Error checking archived thread ${thread.id}:`, err);
      }
    });
  } catch (error) {
    console.error('Error checking all quiz threads:', error);
  }
}

async function showLeaderboard(channel, inputName) {
  const mapNames = availableMapNames;

  const normalizedInput = inputName?.toLowerCase();

  let mapName = mapAliases[normalizedInput] || inputName;

  if (!mapName || !mapNames.includes(mapName)) {
    const similarMap = mapNames.find(m => m.toLowerCase() === normalizedInput);
    if (similarMap) {
      mapName = similarMap;
    } else {
      await channel.send(`Map "${inputName}" not found. Available maps: ${mapNames.join(', ')}`);
      return;
    }
  }

  const mapLeaderboard = leaderboardStreaks[mapName] || [];

  if (mapLeaderboard.length === 0) {
    await channel.send(`No leaderboard data for map "${mapName}" yet. Be the first to set a record!`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${mapName} - Leaderboard`)
    .setColor('#f1c40f')
    .setFooter({ text: `Updated: ${new Date().toISOString().split('T')[0]}` });

  const topPlayers = mapLeaderboard.slice(0, 10);

  let description = '';
  topPlayers.forEach((entry, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    const time = formatTime(entry.totalTime);
    description += `${medal} **${entry.username}** - Streak: ${entry.streak} | Time: ${time}\n`;
  });

  embed.setDescription(description);
  await channel.send({ embeds: [embed] });
}



async function showPersonalStats(message) {
  let userId = message.author.id;
  let username = message.author.username;
  let targetUser = message.author;
  
  const content = message.content.trim();
  if (content.startsWith('!stats ')) {
    const mentionOrName = content.substring('!stats '.length).trim();
    
    if (message.mentions.users.size > 0) {
      targetUser = message.mentions.users.first();
      userId = targetUser.id;
      username = targetUser.username;
    }
    else if (mentionOrName) {
      let found = false;
      
      for (const [id, maps] of Object.entries(personalBestStreaks)) {
        for (const mapData of Object.values(maps)) {
          if (mapData.username && mapData.username.toLowerCase() === mentionOrName.toLowerCase()) {
            userId = id;
            username = mapData.username;
            const user = client.users.cache.get(id);
            if (user) {
              targetUser = user;
            }
            found = true;
            break;
          }
        }
        
        if (found) break;
      }
      
      if (!found) {
        return message.reply(`User "${mentionOrName}" not found in stats database`);
      }
    }
  }
  
  const userStats = personalBestStreaks[userId] || {};
  
  if (Object.keys(userStats).length === 0) {
    return message.reply(`${username} doesn't have streak yet (noob)`);
  }
  
  const embed = new EmbedBuilder()
    .setTitle(`📊 Stats for ${username}`)
    .setColor('#9b59b6');
  
  let description = '';
  for (const [mapName, stats] of Object.entries(userStats)) {
    const formattedTime = formatTime(stats.totalTime);
    
    let position = 'not ranked';
    if (leaderboardStreaks[mapName]) {
      const userPos = leaderboardStreaks[mapName].findIndex(entry => entry.userId === userId);
      if (userPos >= 0) {
        position = `#${userPos + 1}`;
      }
    }
    
    description += `**${mapName}**\n`;
    description += `Best Streak: ${stats.streak} | Time: ${formattedTime} | Rank: ${position}\n\n`;
  }
  
  embed.setDescription(description);
  await message.reply({ embeds: [embed] });
}


client.on('interactionCreate', async (interaction) => {
    console.log('Interaction received:', interaction.type, interaction.customId ?? 'no customId');

    if (interaction.isButton() && interaction.customId === 'create_private_thread') {
      console.log('Button clicked:', interaction.customId);
      await createPrivateThread(interaction, interaction.user.id);
    }
  });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  initializeThreadCleanup();
  await initializeResources();
  try {
    await initializeResources();
  } catch (error) {
    console.error("Erreur lors de l'initialisation des ressources:", error);
  }
  
});

async function sendPrivateMessageOffer() {
  try {
    const channel = await client.channels.fetch(ANN_CHANNEL_ID);
    if (!channel) {
      console.error('Quiz channel not found');
      return;
    }
    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_private_thread')
          .setLabel('Create Private Quiz Thread')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎮')
      );
    
    const embed = new EmbedBuilder()
      .setTitle('🌍 Start Your Private Session')
      .setDescription(
        '**Play uninterrupted, at your own pace.**\nCreate a private thread just for you — perfect for solo challenges or games with friends.'
      )
      .addFields(
        {
          name: '👥 Multiplayer Control',
          value: 'Use `!invite @user` to invite friends, and `!kick @user` to remove them from your thread.'
        }
      )
      .setColor('#3498db')
      .setFooter({ text: 'Private threads auto-clean after inactivity.' });

    await channel.send({
      embeds: [embed],
      components: [row]
    });

    
    console.log('Private thread creation message sent');
  } catch (error) {
    console.error('Error sending private message offer:', error);
  }
}

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  
  const content = message.content.trim();
  
  if (content === '!private_msg' && message.channel.id === PRIVATE_MSG_CHANNEL_ID) {
    if (message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await sendPrivateMessageOffer();
      await message.reply('Private thread creation message sent to the quiz channel!');
    } else {
      await message.reply('You do not have permission to use this command.');
    }
    return;
  }
  
  if (content.startsWith('!invite') && message.mentions.users.size > 0) {
    const mentionedUser = message.mentions.users.first();

    if (!message.channel.isThread()) {
      await message.reply('❌ This command can only be used inside a thread.');
      return;
    }

    try {
      await message.channel.members.add(mentionedUser.id);
      await message.reply(`✅ Successfully invited ${mentionedUser.username} to the thread.`);
    } catch (error) {
      console.error('Error inviting user:', error);
      await message.reply('❌ Failed to invite the user. Make sure I have the correct permissions.');
    }

    return;
  }

  if (content.startsWith('!kick') && message.mentions.users.size > 0) {
    const mentionedUser = message.mentions.users.first();

    if (!message.channel.isThread()) {
      await message.reply('❌ This command can only be used inside a thread.');
      return;
    }

    try {
      await message.channel.members.remove(mentionedUser.id);
      await message.reply(`✅ Successfully kicked ${mentionedUser.username} from the thread.`);
    } catch (error) {
      console.error('Error kicking user:', error);
      await message.reply('❌ Failed to kick the user. Make sure I have the correct permissions.');
    }

    return;
  }

  if (message.content.trim().toLowerCase() === '!stop') {
    const channelId = message.channel.id;
    const quiz = quizzesByChannel[channelId];

    if (!quiz || quiz.solved) {
      return message.reply("❌ There's no ongoing game to stop in this channel.");
    }

    quiz.solved = true;

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🛑 Game Stopped')
          .setDescription(`The current game has been stopped manually.`)
          .addFields(
            { name: 'Final Streak', value: `${quiz.currentStreak}`, inline: true },
            {
              name: "Exact Location",
              value: `[View on Street View](https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${quiz.location.lat},${quiz.location.lng}&heading=0&pitch=0)`
            }
          )
          .setColor('#f39c12')
      ]
    });

    delete quizzesByChannel[channelId];
    return;
  }

  else if (content.startsWith('!g ') && quizzesByChannel[message.channel.id] && !quizzesByChannel[message.channel.id].solved) {
    await handleGuess(message, message.content);
  }
  if (content.startsWith('!play')) {
    if (
      message.channel.id !== QUIZ_CHANNEL_ID &&
      (!message.channel.isThread() || message.channel.parentId !== QUIZ_CHANNEL_ID)
    ) {
      return;
    }

    if (quizzesByChannel[message.channel.id] && !quizzesByChannel[message.channel.id].solved) {
      await message.reply("There's already an active quiz. Solve it first or wait for it to complete!");
      return;
    }
    
    const args = message.content.split(' ').slice(1);
    const mapName = args.length > 0 ? args.join(' ') : null;
    
    if (mapName) {
      const matchedMapName = Object.keys(maps).find(
        key => key.toLowerCase() === mapName.toLowerCase()
      );
      
      await startQuiz(message.channel, matchedMapName || mapName, message.author.id);
    } else {
      await startQuiz(message.channel, null, message.author.id);
    }
  } else if (content === '!maps') {
        if (
      message.channel.id !== QUIZ_CHANNEL_ID &&
      (!message.channel.isThread() || message.channel.parentId !== QUIZ_CHANNEL_ID)
    ) {
      return;
    }

    const mapNames = Object.keys(maps);
    const mapsEmbed = new EmbedBuilder()
      .setTitle('Available Maps')
      .setDescription(mapNames.join('\n'))
      .setColor('#3498db');
    
    await message.channel.send({ embeds: [mapsEmbed] });
  } else if (content === '!help') {
    if (
      message.channel.id !== QUIZ_CHANNEL_ID &&
      (!message.channel.isThread() || message.channel.parentId !== QUIZ_CHANNEL_ID)
    ) {
      return;
    }

    const helpEmbed = new EmbedBuilder()
      .setTitle('Bot Commands')
      .setDescription('Here are the available commands:')
      .addFields(
        { name: '!play', value: 'Start a new quiz with a random map' },
        { name: '!play <map>', value: 'Start a new quiz with the specified map' },
        { name: '!g <country>', value: 'Submit your guess for the current quiz' },
        { name: '!maps', value: 'Show all available maps' },
        { name: '!stats', value: 'Show your personal stats and records' },
        { name: '!leaderboard <map>', value: 'Show the leaderboard for a specific map' },
        { name: '!invite @user', value: 'Invite a user to your private thread *(only works in threads)*' },
        { name: '!help', value: 'Show this help message' }
      )
      .setColor('#3498db');
    
    await message.channel.send({ embeds: [helpEmbed] });
  } if (content.startsWith('!stats')) {
    if (
      message.channel.id !== QUIZ_CHANNEL_ID &&
      (!message.channel.isThread() || message.channel.parentId !== QUIZ_CHANNEL_ID)
    ) {
      return;
    }

    await showPersonalStats(message);
    return;
  } else if (content.startsWith('!leaderboard')) {
    if (
      message.channel.id !== QUIZ_CHANNEL_ID &&
      (!message.channel.isThread() || message.channel.parentId !== QUIZ_CHANNEL_ID)
    ) {
      return;
    }

    const input = message.content.substring('!leaderboard'.length).trim().toLowerCase();

    const resolvedMapName = mapAliases[input] || availableMapNames.find(
      name => name.toLowerCase() === input
    );

    if (!resolvedMapName) {
      return message.reply({
        content: `Unknown map: \`${input}\`. Try one of: ${availableMapNames.join(', ')}`,
        ephemeral: true
      });
    }

    await showLeaderboard(message.channel, resolvedMapName);
  }

});

function loadStreakData() {
  try {
    if (fs.existsSync(PB_STREAK_PATH)) {
      const data = fs.readFileSync(PB_STREAK_PATH, 'utf8');
      personalBestStreaks = JSON.parse(data);
      console.log(`Loaded ${Object.keys(personalBestStreaks).length} user records`);
    } else {
      console.log('Personal best streak file does not exist, creating new one');
      personalBestStreaks = {};
      saveJsonFile(PB_STREAK_PATH, personalBestStreaks);
    }

    if (fs.existsSync(LB_STREAK_PATH)) {
      const data = fs.readFileSync(LB_STREAK_PATH, 'utf8');
      leaderboardStreaks = JSON.parse(data);
      console.log(`Loaded leaderboards for ${Object.keys(leaderboardStreaks).length} maps`);
    } else {
      console.log('Leaderboard streak file does not exist, creating new one');
      leaderboardStreaks = {};
      saveJsonFile(LB_STREAK_PATH, leaderboardStreaks);
    }
  } catch (error) {
    console.error('Error loading streak data:', error);
    personalBestStreaks = {};
    leaderboardStreaks = {};
  }
}
function initializeThreadCleanup() {
  checkAllQuizThreadsForInactivity();
  setInterval(() => {
    checkAllQuizThreadsForInactivity();
  }, 6 * 60 * 60 * 1000);
}

loadStreakData();
client.login(TOKEN);
// by @flykii on discord
