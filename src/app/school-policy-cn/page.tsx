"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  FileText,
  Calendar,
  DollarSign,
  Shield,
  Heart,
  Camera,
  Cloud,
  AlertTriangle,
  Phone,
  Mail,
  ChevronRight,
  ArrowUp,
} from "lucide-react"

const policies = [
  {
    id: "registration-insurance",
    title: "报名与保险要求",
    icon: Shield,
    content: [
      "在任何小组课程开始前，每个家庭需完成以下步骤：(1) 创建家长账户；(2) 将孩子添加为泳员；(3) 完成报名（包括必填表单/免责声明、紧急联系人等）。",
      "报名完成后，训练与项目活动的保险才会生效。出于安全与责任考虑，未完成报名的泳员不得参加小组训练。",
      "返校家庭需保持所有信息为最新（医疗/紧急联系人、免责声明与付款信息等），并按俱乐部/LSC 要求完成续签。",
      "教练与工作人员可在签到时核验泳员的报名状态；必要时可能要求出示报名证明。",
    ],
  },
  // 出勤与名额保留（新增）
  {
    id: "attendance-hold",
    title: "出勤与名额保留（小组课）",
    icon: Shield,
    content: [
      "如泳员连续 14 个日历日未上任何课程，且家庭未提前 14 天与我们协调，我们将不再为该泳员保留名额，并把名额提供给候补名单上的下一位。",
      "如需保留小组名额，须按时支付全额常规月费。暂停缴费或部分缴费均不保留名额。",
      "缺课可按下文规定，参加每月一次的补课诊所（视具体情况而定）。",
    ],
  },
  {
    id: "makeup-cancellation",
    title: "补课与请假政策（小组课）",
    icon: Calendar,
    content: [
      "本节适用于小组课程；私教课程请参见下方《私教取消政策》。",
      "Prime Swim Academy 为错过常规小组课的泳员，每月提供一次补课诊所。补课时间将每月公布于官网/日历，并通过电子邮件/微信通知。",
      "资格：每名泳员每个日历月最多一次补课。",
      "当月缺课不结转至次月。允许结转会影响公平与排课稳定，也不利于跟踪泳员进度。",
      "补课名额不可滚存、不可转让、亦不可折算为退款或学费抵扣。",
      "如需缺席，请至少提前 24 小时告知以便我们协调排课；未提前告知且未出席者不享受补课。",
    ],
  },
  {
    id: "private-cancellation",
    title: "私教课程取消政策",
    icon: Calendar,
    content: [
      "如需取消，请至少在预定私教课程开始前 7 天提出，方可获得改期。",
      "在 Mary Wayte Swimming Pool 进行的课程，因场馆排期政策，至少需提前 14 天通知。",
      "逾期取消将视为放弃该次课程且不予退款或补课；对于有有效证明的医疗紧急情况，我们会酌情处理。",
      "经批准的医疗紧急情形下，家庭仍需承担 Prime Swim Academy 为该时段已支付给泳池的泳道租赁费用。",
      "改期以教练与泳道资源可用性为准。",
    ],
  },
  {
    id: "refund",
    title: "退款政策",
    icon: DollarSign,
    content: [
      "若在课程开课前至少两周提出取消，可退款。",
      "课程开始后不予退款；如遇医疗紧急情况且提供有效医疗证明，经审核符合条件者可享受按比例退款或获得未来课程学分。",
      "如因 Prime Swim Academy 主动取消课程或场馆关闭导致课程取消，将按比例退费或提供未来课程学分。",
    ],
  },
  {
    id: "code-of-conduct",
    title: "行为准则",
    icon: Shield,
    content: [
      "所有泳员、家长/监护人须对教练、工作人员及其他学员保持尊重。",
      "如出现霸凌、骚扰、攻击性行为或不当言语，学院可采取纪律措施，包括但不限于停训或开除且不退款。",
      "参与者必须始终遵循教练与工作人员的安全指引。",
    ],
  },
  {
    id: "safety-health",
    title: "安全与健康政策",
    icon: Heart,
    content: [
      "如出现发热、传染性皮肤病或呼吸道症状等不适，泳员不得参加课程。",
      "如有既往病史或健康顾虑，请及时告知教练。",
      "Prime Swim Academy 保留在必要时要求提供医生健康证明后方可参加的权利。",
    ],
  },
  {
    id: "photo-video",
    title: "照片与视频使用同意",
    icon: Camera,
    content: [
      "家长/监护人可自愿同意学院在宣传材料（册页、社交媒体与官网）中使用其子女的照片或视频。",
      "同意为可选项，需在报名流程中明确勾选。",
    ],
  },
  {
    id: "weather-closure",
    title: "天气与场馆关闭政策",
    icon: Cloud,
    content: [
      "遇到恶劣天气，学院将遵循当地安全建议。任何取消或关闭将通过电子邮件、微信或既定渠道通知。",
      "因天气导致的停课可在资源允许的情况下安排补课；不提供退款。",
    ],
  },
  {
    id: "liability",
    title: "责任豁免",
    icon: AlertTriangle,
    content: [
      "参与游泳活动存在固有风险。家长/监护人认可并接受这些风险，并放弃就正常参与过程中产生的伤害向 Prime Swim Academy、其雇员或关联方提出索赔。",
      "本豁免不涵盖因故意不当行为造成的责任。",
    ],
  },
  {
    id: "medical-treatment",
    title: "医疗处置授权",
    icon: Heart,
    content: [
      "如遇紧急情况，学院工作人员将首先尝试联系报名时提供的家长/监护人或紧急联系人。",
      "若无法立即取得联系，家长/监护人在此授权学院工作人员实施必要的现场急救，并在必要时寻求专业医疗帮助。",
    ],
  },
]

export default function SchoolPoliciesPage() {
  const [activeSection, setActiveSection] = useState<string>("")

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
      setActiveSection(id)
    }
  }

  // 根据滚动位置更新激活的目录项
  useEffect(() => {
    const handleScroll = () => {
      const sections = policies.map(policy => policy.id)
      const scrollPosition = window.scrollY + 100

      for (let i = sections.length - 1; i >= 0; i--) {
        const element = document.getElementById(sections[i])
        if (element && element.offsetTop <= scrollPosition) {
          setActiveSection(sections[i])
          break
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* 头图区域 */}
      <section className="relative py-20 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-cyan-600/10"></div>
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="w-24 h-24 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg">
            <FileText className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-6">
            学校政策 School Policies
          </h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed mb-8">
            请查阅以下政策，确保每位学员在 Prime Swim Academy 拥有安全、尊重且愉快的学习体验。
          </p>
          <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 px-4 py-2">
            最后更新：2025 年 7 月 1 日
          </Badge>
        </div>
      </section>

      <div className="container mx-auto px-4 pb-16 -mt-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* 快速导航 */}
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm mb-8">
            <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-t-lg">
              <CardTitle className="text-xl font-bold flex items-center">
                <FileText className="w-6 h-6 mr-3" />
                快速导航 Quick Navigation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                {policies.map((policy, index) => {
                  const IconComponent = policy.icon
                  const isActive = activeSection === policy.id
                  return (
                    <Button
                      key={policy.id}
                      variant={isActive ? "default" : "ghost"}
                      className={`justify-start h-auto p-3 text-left transition-colors ${
                        isActive 
                          ? "bg-blue-600 text-white hover:bg-blue-700" 
                          : "hover:bg-blue-50 hover:text-blue-700"
                      }`}
                      onClick={() => scrollToSection(policy.id)}
                    >
                      <IconComponent className={`w-4 h-4 mr-2 ${isActive ? "text-white" : "text-blue-500"}`} />
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {index + 1}. {policy.title}
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 ml-2 ${isActive ? "text-white" : ""}`} />
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* 政策章节 */}
          <div className="space-y-8">
            {policies.map((policy, index) => {
              const IconComponent = policy.icon
              return (
                <Card
                  key={policy.id}
                  id={policy.id}
                  className="shadow-xl border-0 bg-white/80 backdrop-blur-sm scroll-mt-20"
                >
                  <CardHeader className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
                    <CardTitle className="text-2xl font-bold flex items-center">
                      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mr-4">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-sm opacity-80 font-normal">政策 Policy {index + 1}</div>
                        <div>{policy.title}</div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                    <div className="space-y-4">
                      {policy.content.map((item, itemIndex) => (
                        <div
                          key={itemIndex}
                          className="flex items-start space-x-3 p-4 bg-slate-50 rounded-lg border-l-4 border-blue-500"
                        >
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-blue-600 font-bold text-sm">{itemIndex + 1}</span>
                          </div>
                          <p className="text-slate-700 leading-relaxed">{item}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* 联系方式 */}
          <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm mt-12">
            <CardHeader className="bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-t-lg">
              <CardTitle className="text-2xl font-bold flex items-center">
                <Phone className="w-7 h-7 mr-3" />
                联系方式 Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <p className="text-lg text-slate-600 mb-6">
                  如对上述政策有任何疑问或需进一步说明，请与我们联系：
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-lg border border-blue-100">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mr-4">
                      <Mail className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">邮件 Email</h3>
                      <p className="text-slate-600 text-sm">我们会在 24 小时内回复</p>
                    </div>
                  </div>
                  <a
                    href="mailto:prime.swim.us@gmail.com"
                    className="text-blue-600 font-semibold hover:text-blue-700 transition-colors"
                  >
                    prime.swim.us@gmail.com
                  </a>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border border-green-100">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mr-4">
                      <Phone className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">电话 Phone</h3>
                      <p className="text-slate-600 text-sm">周一至周五 8:00-18:00；周六 9:00-15:00</p>
                    </div>
                  </div>
                  <a
                    href="tel:+14014020052"
                    className="text-green-600 font-semibold hover:text-green-700 transition-colors"
                  >
                    (401) 402-0052
                  </a>
                </div>
              </div>

              <div className="mt-8 p-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-lg border border-slate-200">
                <p className="text-center text-slate-600 leading-relaxed">
                  <strong className="text-slate-800">感谢您的配合</strong>，共同维护
                  <span className="font-semibold text-blue-600"> Prime Swim Academy </span>
                  安全、尊重与愉快的学习环境。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 回到顶部 */}
      <Button
        onClick={scrollToTop}
        className="fixed bottom-8 right-8 w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg z-50"
        size="icon"
      >
        <ArrowUp className="w-5 h-5" />
      </Button>
    </div>
  )
}
