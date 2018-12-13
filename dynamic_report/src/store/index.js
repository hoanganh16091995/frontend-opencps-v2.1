import Vue from 'vue'
import Vuex from 'vuex'
import axios from 'axios'
import saveAs from 'file-saver'
// import support from './support.json'
import AdminConfig from './AdminConfig'
Vue.use(Vuex)

export const store = new Vuex.Store({
  state: {
    groupId: window.themeDisplay !== undefined ? window.themeDisplay.getScopeGroupId() : 0,
    snackbarerror: false,
    snackbarsocket: false,
    refreshSocket: 0,
    initData: {},
    dataSocket: {},
    pullCounter: 0,
    tocken: '',
    loginUser: [
      {
        'email': '',
        'role': ''
      }
    ],
    user: null,
    socket: {
      isConnected: false,
      message: '',
      reconnectError: false
    },
    endPointApi: '/o/rest/v2',
    // endPointApi: 'http://127.0.0.1:8081/api',
    getDeliverableTypes: [],
    getContentFile: '',
    getContentFileSimple: [],
    selected: ['dossierNo', 'delegateName', 'delegateAddress', 'delegateTelNo', 'receiveDate', 'dueDate'],
    reportType: 'REPORT_01',
    groupType: 'domain',
    siteName: '',
    itemsReports: []
  },
  actions: {
    loadInitResource ({commit, state}) {
      return new Promise((resolve) => {
        if (window.themeDisplay !== null && window.themeDisplay !== undefined) {
          state.initData['groupId'] = window.themeDisplay.getScopeGroupId()
          state.initData['user'] = {
            'userName': window.themeDisplay.getUserName(),
            'userEmail': '',
            'userId': window.themeDisplay.getUserId()
          }
        } else {
          state.initData['groupId'] = 0
          state.initData['user'] = {
            'userName': '',
            'userEmail': '',
            'userId': 20103
          }
        }
        let param = {
          headers: {
            groupId: state.initData['groupId']
          }
        }
        axios.get('/o/v1/opencps/site/name', param).then(function (response) {
          let serializable = response.data
          state.siteName = serializable
          console.log(state.siteName)
          commit('setsiteName', serializable)
          resolve(state.initData)
        }).catch(function (error) {
          console.log(error)
        })
      })
    },
    updateDynamicReport ({ commit, state }, doData) {
      return new Promise((resolve, reject) => {
        let options = {
          headers: {
            'groupId': state.groupId,
            'Content-Type': 'text/plain',
            'Accept': 'application/json'
          }
        }
        let currentObject = {}
        for (let key in doData.itemsReports) {
          if (doData.itemsReports[key]['code'] === String(doData.index)) {
            currentObject = doData.itemsReports[key]
            break
          }
        }
        // putData
        let userConfigEdit = eval('( ' + currentObject['userConfig'] + ' )')
        userConfigEdit[doData.userId] = doData.selected
        currentObject['userConfig'] = userConfigEdit
        currentObject['userConfig'] = eval('( ' + currentObject['userConfig'] + ' )')
        currentObject['filterConfig'] = eval('( ' + currentObject['filterConfig'] + ' )')
        currentObject['tableConfig'] = eval('( ' + currentObject['tableConfig'] + ' )')
        console.log('ddd: ', JSON.stringify(currentObject))
        let body = AdminConfig.updateDynamicReport.replace('INPUTBODY', JSON.stringify(currentObject).replace(/"/g, '\\"').replace(/'/g, '\\"'))
        axios.post('/o/v1/opencps/adminconfig', body, options).then(function (response) {
          console.log(response)
          resolve(response.data)
        }).catch(function (error) {
          commit('setsnackbarerror', true)
          reject(error)
        })
      })
    },
    getDynamicReports ({commit, state}) {
      return new Promise(() => {
        let options = {
          headers: {
            'groupId': state.groupId,
            'Content-Type': 'text/plain',
            'Accept': 'application/json'
          }
        }
        let body = AdminConfig.getDynamicReports
        axios.post('/o/v1/opencps/adminconfig', body, options).then(function (response) {
          let serializable = response.data
          let itemsReportsData = []
          let indexKey = 0
          for (let key in serializable['getDynamicReports']) {
            let current = serializable['getDynamicReports'][key]
            let typeCurrent = 'dossier'
            if (current['reportCode'].startsWith('REPORT_FIX')) {
              typeCurrent = 'thong_ke'
            }
            itemsReportsData.push({
              'code' : String(indexKey),
              'document' : current['reportCode'],
              'active' : false,
              'type' : typeCurrent,
              'title' : current['reportName'],
              'filterConfig' : current['filterConfig'],
              'tableConfig' : current['tableConfig'],
              'userConfig' : current['userConfig']
            })
            indexKey = indexKey + 1
          }
          state.itemsReports = itemsReportsData
        }).catch(function () {
          state.itemsReports = []
          commit('setsnackbarerror', true)
        })
      })
    },
    getAgencyReportLists ({state}, filter) {
      return new Promise((resolve, reject) => {
        store.dispatch('loadInitResource').then(function () {
          let param = {
            headers: {
              groupId: state.initData.groupId,
              Accept: 'application/json'
            },
            params: {
              year: filter.year,
              month: filter.month ? filter.month : 0,
              group: filter.group,
              reporting: false,
              agency: filter['agency']
            }
          }
          let govAgency = filter['govAgency']
          let agencyLists = filter['agencyLists']
          let requestURL = ''
          if (filter.document === 'REPORT_01' || filter.document.startsWith('REPORT_FIX')) {
            // test local
            // requestURL = 'http://127.0.0.1:8081/api/statistics'
            requestURL = '/o/rest/statistics'
            param.params['fromStatisticDate'] = filter.fromDate
            param.params['toStatisticDate'] = filter.toDate
            if (govAgency === undefined || govAgency === null || govAgency === '') {
              axios.get(requestURL, param).then(function (response) {
                let serializable = response.data
                if (serializable.data) {
                  resolve(serializable.data)
                } else {
                  resolve(null)
                }
              }).catch(function (error) {
                console.log(error)
                reject(error)
              })
            } else if (String(govAgency['value']) === '0' && govAgency !== undefined) {
              let promises = []
              for (let key in agencyLists) {
                if (String(agencyLists[key]['value']) !== '0') {
                  param['headers']['groupId'] = agencyLists[key]['value']
                  promises.push(axios.get(requestURL, param))
                }
              }
              axios.all(promises)
              .then(axios.spread((...args) => {
                let myObject = []
                for (let i = 0; i < args.length; i++) {
                  if (args[i]['data']['total'] > 0) {
                    console.log(args[i]['data']['data'])
                    myObject = myObject.concat(args[i]['data']['data'])
                  }
                }
                console.log('myObject', myObject)
                if (myObject.length > 0) {
                  resolve(myObject)
                } else {
                  resolve(null)
                }
              }))
            } else if (String(govAgency['value']) !== '0' && govAgency !== undefined) {
              if (govAgency['value'] !== undefined) {
                param['headers']['groupId'] = govAgency['value']
              }
              axios.get(requestURL, param).then(function (response) {
                let serializable = response.data
                if (serializable.data) {
                  resolve(serializable.data)
                } else {
                  resolve(null)
                }
              }).catch(function (error) {
                console.log(error)
                reject(error)
              })
            }
          } else {
            // test local
            // requestURL = 'http://127.0.0.1:8081/api/dossiers'
            requestURL = '/o/rest/v2/dossiers'
            param.params['sort'] = 'domainCode'
            if (filter.document === 'REPORT_05') {
              param.params['fromFinishDate'] = filter.fromDate
              param.params['toFinishDate'] = filter.toDate
            } else if (filter.document === 'REPORT_09') {
              param.params['fromReleaseDate'] = filter.fromDate
              param.params['toReleaseDate'] = filter.toDate
            } else if (filter.document === 'REPORT_10') {
              param.params['fromReceiveNotDoneDate'] = filter.fromDate
              param.params['toReceiveNotDoneDate'] = filter.toDate
            } else {
              param.params['fromReceiveDate'] = filter.fromDate
              param.params['toReceiveDate'] = filter.toDate
            }
            if (govAgency === undefined || govAgency === null || govAgency === '') {
              axios.get(requestURL, param).then(function (response) {
                let serializable = response.data
                if (serializable.data) {
                  let dataReturn = serializable.data
                  resolve(dataReturn)
                } else {
                  resolve(null)
                }
              }).catch(function (error) {
                console.log(error)
                reject(error)
              })
            } else if (String(govAgency['value']) === '0' && govAgency !== undefined) {
              let promises = []
              for (let key in agencyLists) {
                if (String(agencyLists[key]['value']) !== '0') {
                  param['headers']['groupId'] = agencyLists[key]['value']
                  promises.push(axios.get(requestURL, param))
                }
              }
              axios.all(promises)
              .then(axios.spread((...args) => {
                let myObject = []
                for (let i = 0; i < args.length; i++) {
                  if (args[i]['data']['total'] > 0) {
                    console.log(args[i]['data']['data'])
                    myObject = myObject.concat(args[i]['data']['data'])
                  }
                }
                console.log('myObjectdossier', myObject)
                if (myObject.length > 0) {
                  resolve(myObject)
                } else {
                  resolve(null)
                }
              }))
            } else if (String(govAgency['value']) !== '0' && govAgency !== undefined) {
              if (govAgency['value'] !== undefined) {
                param['headers']['groupId'] = govAgency['value']
              }
              axios.get(requestURL, param).then(function (response) {
                let serializable = response.data
                if (serializable.data) {
                  let dataReturn = serializable.data
                  resolve(dataReturn)
                } else {
                  resolve(null)
                }
              }).catch(function (error) {
                console.log(error)
                reject(error)
              })
            }
          }
        })
      })
    },
    doStatisticReportPrint ({state}, filter) {
      return new Promise((resolve, reject) => {
        store.dispatch('loadInitResource').then(function () {
          axios({
            method: 'PUT',
            url: '/o/rest/v2_1/statistics/report/' + filter.document,
            headers: {
              groupId: state.initData.groupId
            },
            responseType: 'blob',
            data: filter.data
          }).then(function (response) {
            console.log('serializable', response)
            let serializable = response.data
            if (filter['download']) {
              saveAs(serializable, new Date().getTime() + '.xls')
            } else {
              let file = window.URL.createObjectURL(serializable)
              resolve(file)
            }
          }).catch(function (error) {
            reject(error)
          })
        })
      })
    }
  },
  mutations: {
    setInitData (state, payload) {
      state.initData = payload
    },
    setsnackbarerror (state, payload) {
      state.snackbarerror = payload
    },
    setsnackbarsocket (state, payload) {
      state.snackbarsocket = payload
    },
    setpullCounter (state, payload) {
      state.pullCounter = payload
    },
    setdataSocket (state, payload) {
      state.dataSocket = payload
    },
    setselected (state, payload) {
      state.selected = payload
    },
    setreportType (state, payload) {
      state.reportType = payload

    },
    setgroupType (state, payload) {
      state.groupType = payload
    },
    setsiteName (state, payload) {
      state.siteName = payload
    },
    setitemsReports (state, payload) {
      state.itemsReports = payload
    }
  },
  getters: {
    getsnackbarerror (state) {
      return state.snackbarerror
    },
    getsnackbarsocket (state) {
      return state.snackbarsocket
    },
    getDeliverableTypes (state) {
      return state.getDeliverableTypes
    },
    getContentFile (state) {
      return state.getContentFile
    },
    getContentFileSimple (state) {
      return state.getContentFileSimple
    },
    pullCounter (state) {
      return state.pullCounter
    },
    dataSocket (state) {
      return state.dataSocket
    },
    selected (state) {
      return state.selected
    },
    reportType (state) {
      return state.reportType
    },
    groupType (state) {
      return state.groupType
    },
    siteName (state) {
      return state.siteName
    },
    itemsReports (state) {
      return state.itemsReports
    }
  }
})
