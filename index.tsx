import React, {useEffect, useState} from 'react';
import {useLocation} from 'react-router-dom';
import jsBridge from '@gaotu/js-bridge';
import qs from 'qs';
import {setShareAppMessage} from '@/config/wxsdk';
import {getLeadsIdBySource, isGaotuApp, isWechat, parseQueries} from '@/utils';
import usePageStatusEvent, {pageStatusModules} from '@/hooks/use-page-status-event';
import ReportStatusBar from '@/components/report-status-bar';
import ModuleShell from '@/components/module-shell';
import BasicGuideCard from '@/components/basic-guide-card';
import TeacherGuide from '@/components/teacher-guide';
import ShareModule from '@/components/share-module';
import RetestModule from '@/components/retest-module';
import StudyReportEntry from '@/components/study-report-entry';
import {getReportDetail, getTeacherWatchRptDetail} from '@/service/servers';
import {
    EEntryType,
    IAllResponseData,
    IModuleData,
    IShareInfo,
    ISingleModuleData
} from '@/interface';
import '../../assets/style/style.less';
import './style.less';
import {clickReport} from '@/config/habo';
import {EHaboEventId} from '@/config/habo-eventId';
import {EPageStatus, moduleCodes} from './config';


const {
    BASIC_GUIDE_MODULE,
    LANGING_RATE_MODULE,
    INSTITUTION_ANALYSIS_MODULE,
    LEARNING_SITUATION_MODULE,
    LEARNING_PROPOSAL_MODULE,
    TEACHER_GUIDE_MODULE,
    SHARE_INFO_MODULE,
    RETEST_MODULE,
    STUDY_REPORT_MODULE
} = moduleCodes;


const shellModulecodes = [
    LANGING_RATE_MODULE,
    INSTITUTION_ANALYSIS_MODULE,
    LEARNING_SITUATION_MODULE,
    LEARNING_PROPOSAL_MODULE
];

const modelShellCommons: {[key: string]: (props: {data: ISingleModuleData}) => JSX.Element} = {};
shellModulecodes.forEach((item: string) => {
    modelShellCommons[item] = ModuleShell;
});

const ModuleComponents = {
    [BASIC_GUIDE_MODULE]: BasicGuideCard,
    [TEACHER_GUIDE_MODULE]: TeacherGuide,
    [SHARE_INFO_MODULE]: ShareModule,
    [RETEST_MODULE]: RetestModule,
    [STUDY_REPORT_MODULE]: StudyReportEntry,
    ...modelShellCommons
};
// @ts-ignore
const getModuleComponent = (code: string, isShowAttr: boolean) => {
    if ((code === SHARE_INFO_MODULE || code === STUDY_REPORT_MODULE) && !isShowAttr) {
        return null;
    }
    return ModuleComponents[code];
};


const Report = () => {
    const {state} = useLocation<{entryType: EEntryType}>();
    const {disabled, source, userId, entryType} = parseQueries();
    const [shareBasicInfo, setShareBasicInfo] = useState<IShareInfo>({
        studentName: '',
        shareMainTitle: '',
        shareSubTitle: '',
        shortUrl: '',
        questionaireUrl: ''
    });
    // ????????????????????????
    const [pageStatus, setPageStatus] = usePageStatusEvent(0);
    const [reportData, setReportData] = useState<ISingleModuleData[]>([]);
    const [reportModuleData, setReportModuleData] = useState<IModuleData>();
    const [isShowTitleBar, setIsShowTitleBar] = useState<boolean>(true);
    // ????????????????????????????????????
    const [isShowStudyReportEntry, setIsShowStudyReportEntry] = useState<boolean>(true);
    // ????????????????????????
    const [isShowShareModule, setIsShowShareModule] = useState<boolean>(true);
    const [leadsId, setLeadsId] = useState<string>('');
    const [errorInfo, setErrorInfo] = useState<string>('');

    const PageStatusModule = pageStatusModules[pageStatus];

    // ??????????????????
    const modulesIsShow = {
        [SHARE_INFO_MODULE]: isShowShareModule,
        [STUDY_REPORT_MODULE]: isShowStudyReportEntry
    };

    // ??????????????????
    const dealServersData = (res: IAllResponseData) => {
        const {code, data, error_info} = res;
        if (code === 0 && data) {
            setPageStatus(EPageStatus.success);
            setReportData(data.reportTemplateVOList);
            const moduleData: IModuleData = {};
            data?.reportTemplateVOList?.forEach((list: ISingleModuleData) => {
                moduleData[list.code] = list;
                if (list.code === moduleCodes.SHARE_INFO_MODULE) {
                    // @ts-ignore
                    setShareBasicInfo(list?.templateDTO);
                }
            });
            setReportModuleData(moduleData);
            return;
        }
        setPageStatus(EPageStatus.responseError);
        error_info && setErrorInfo(error_info);
    };
    // ????????????????????????
    const getReportData = () => {
        // loading??????
        setPageStatus(EPageStatus.loading);
        // ??????url????????????sharedUserId
        const urlParams = qs.parse(window.location.search.split('?')[1]);
        if (urlParams.sharedUserId || urlParams.sharedUserId === '') {
            delete urlParams.sharedUserId;
        }
        getReportDetail({
            source,
            leads: leadsId,
            entryType: state?.entryType || +entryType,
            questionnaireUrl: `${env.BASIC_HOST}/c-report/questionnaire?${qs.stringify(urlParams)}`
        }).then((res: IAllResponseData) => {
            dealServersData(res);
        })
            .catch(() => {
                setPageStatus(EPageStatus.netError);
            });
    };
    // ????????????????????????????????????
    const getTeacherWatchRptData = () => {
        setPageStatus(EPageStatus.loading);
        // ??????????????????url????????????userId????????????????????????userId???????????????????????????
        getTeacherWatchRptDetail({
            userId,
            entryType: EEntryType.TEACHER,
        }).then((res: IAllResponseData) => {
            dealServersData(res);
        })
            .catch(() => {
                setPageStatus(EPageStatus.netError);
            });
    };
    // ??????????????????????????????
    useEffect(() => {
        isGaotuApp && jsBridge.callNative({
            apiName: 'handleNavigationStatusBar',
            params: {
                type: 2
            }
        });
        !isGaotuApp && setIsShowTitleBar(false);
        // ???app????????????????????????????????????????????????????????????????????????????????????????????????
        !isGaotuApp && (!disabled || disabled === 'false') && setIsShowStudyReportEntry(false);
        // ???app?????????????????????????????????????????????????????????????????????
        (!isGaotuApp || state?.entryType || +entryType === 1) && setIsShowShareModule(false);
        // ??????leadsId
        const ldsId = getLeadsIdBySource(source);
        ldsId && setLeadsId(ldsId);
        disabled && disabled === 'true' && getTeacherWatchRptData();
        // ????????????
        clickReport(EHaboEventId.ENTRY_PAGE, {
            primary_action: 'report_server_push',
            secondary_action: 'report_app_commit_complete',
            action_value: '???????????????',
        });
    }, []);

    useEffect(() => {
        // leadsId?????????????????????????????????
        (!disabled || disabled && disabled === 'false') && getReportData();
    }, [leadsId]);

    useEffect(() => {
        // ????????????
        const {studentName, shareMainTitle, questionaireUrl, shareSubTitle} = shareBasicInfo;
        isWechat && shareBasicInfo.shareMainTitle
        && setShareAppMessage({
            title: `???${studentName}???${shareMainTitle}`,
            url: questionaireUrl || `${env.BASIC_HOST}/c-report/questionnaire${window.location.search}`,
            content: shareSubTitle,
            img: 'https://jy.gsxcdn.com/fe/lib/resources/images/gtLogo.png',
        });
    }, [shareBasicInfo]);

    return (
        <>
            {
                PageStatusModule
                    ? (
                        <>
                            {
                                isShowTitleBar && pageStatus !== EPageStatus.loading
                                    && <ReportStatusBar hideShareBtn title="GAEF??????" showTitleStill />
                            }
                            <PageStatusModule
                                errorInfo={errorInfo}
                                refreshData={
                                    disabled && disabled === 'true'
                                        ? getTeacherWatchRptData
                                        : getReportData
                                }
                            />
                        </>
                    )
                    : (
                        <>
                            {
                                isShowTitleBar && <ReportStatusBar shareInfo={shareBasicInfo} title="GAEF??????" />
                            }
                            <div styleName="report">
                                {
                                    reportData.map(data => {
                                        const Module =  getModuleComponent(data?.code, modulesIsShow[data?.code]);
                                        return Module && reportModuleData?.[data?.code]
                                        && (
                                            <Module
                                                key={data?.code}
                                                // @ts-ignore
                                                data={reportModuleData?.[data?.code]}
                                                entryType={state?.entryType}
                                            />
                                        );
                                    })
                                }
                            </div>
                        </>
                    )
            }
        </>
    );
};

export default Report;
