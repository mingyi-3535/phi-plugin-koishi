import SaveManager from './SaveManager';
import JSZip from 'jszip';
import fetch from 'node-fetch';
import ByteReader from './ByteReader';
import GameRecord from './GameRecord';
import GameProgress from './GameProgress';
import GameUser from './GameUser';
import GameSettings from './GameSettings';
import { logger } from '../components/Logger';

export default interface PhigrosUser {
    sessionToken: string;
    saveInfo: any;
    gameRecord: any;
    saveUrl: URL;
    Recordver: number;
    gameProgress: GameProgress;
    gameuser: GameUser;
    gamesettings: GameSettings;
    
    chooseSave(choose: any): any;
    getSaveInfo(): any;
    buildRecord(): any;
}

/**
 * @param {String}  session
 * @param {string}  url
 * @param {Object} saveInfo 可能为Array，此时buildRecord返回1
 * @param {JSZip} savezip
 * @param {GameRecord} gameRecord
 */

export default class PhigrosUser {


    constructor(session: string) {
        this.sessionToken = ''
        this.saveInfo = {}
        this.gameRecord = {}
        if (!session.match(/[a-z0-9]{25}/))
            throw new Error("SessionToken格式错误");
        this.sessionToken = session;

    }

    /**
     * 获取 SaveInfo
     */
    async getSaveInfo() {
        this.saveInfo = await SaveManager.saveCheck(this.sessionToken)

        if (this.saveInfo[0] && this.saveInfo[0].createdAt) {
            /**多个存档默认选择第一个 */
            this.saveInfo = this.saveInfo[0]
        } else {
            logger.error(`[Phi-Plugin]错误的存档`)
            logger.error(this.saveInfo)
            throw new Error("未找到存档QAQ！")
        }

        try {
            this.saveUrl = new URL(this.saveInfo.gameFile.url);
        } catch (err) {

            logger.error("[phi-plugin]设置saveUrl失败！", err)

            throw new Error(err)
        }
        return this.saveInfo
    }

    /**
     * 
     * @returns 返回未绑定的信息数组，没有则为false
     */
    async buildRecord() {
        if (!this.saveUrl) {

            await this.getSaveInfo()

        }
        if (this.saveUrl) {
            /**从saveurl获取存档zip */
            let save = await fetch(this.saveUrl, { method: 'GET' })

            try {
                var savezip = await JSZip.loadAsync(await save.arrayBuffer())

            } catch (err) {
                logger.error(err)
                throw new Error("解压zip文件失败！ " + err)

            }


            /**插件存档版本 */
            this.Recordver = 1.0

            /**获取 gameProgress */
            let file = new ByteReader(await savezip.file('gameProgress').async('nodebuffer'))
            file.getByte()
            this.gameProgress = new GameProgress(await SaveManager.decrypt(file.getAllByte()))

            /**获取 gameuser */
            file = new ByteReader(await savezip.file('user').async('nodebuffer'))
            file.getByte()
            this.gameuser = new GameUser(await SaveManager.decrypt(file.getAllByte()))

            /**获取 gamesetting */
            file = new ByteReader(await savezip.file('settings').async('nodebuffer'))
            file.getByte()
            this.gamesettings = new GameSettings(await SaveManager.decrypt(file.getAllByte()))

            /**获取gameRecord */
            file = new ByteReader(await savezip.file('gameRecord').async('nodebuffer'))
            if (file.getByte() != GameRecord.version) {
                this.gameRecord = {}

                logger.info("版本号已更新，请更新PhigrosLibrary。");

                throw new Error("版本号已更新")
            }
            let Record = new GameRecord(await SaveManager.decrypt(file.getAllByte()));
            const err = []
            await Record.init(err)
            this.gameRecord = Record.Record
            if (err) {
                return err
            }

        } else {
            logger.info("获取存档链接失败！")

            throw new Error("获取存档链接失败！")
        }
        return null
    }

}

