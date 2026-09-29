import type { AssemblyPlan } from '../lib/types';

/**
 * 示例方案：虚构书架「云梯·三层书架 YT-300」。
 * 管理员可在“管理配置”页基于它修改，或恢复默认。
 */
export const defaultPlan: AssemblyPlan = {
  id: 'yunti-yt300',
  name: '云梯·三层书架 YT-300',
  description: '虚构产品，仅作演示。三层开放式书架，宽约 80cm，高约 110cm。',
  parts: [
    { id: 'p-side', name: '侧板', quantity: 2, spec: '1080×300×18mm' },
    { id: 'p-top', name: '顶板', quantity: 1, spec: '800×300×18mm' },
    { id: 'p-bottom', name: '底板', quantity: 1, spec: '800×300×18mm' },
    { id: 'p-shelf', name: '层板', quantity: 2, spec: '764×280×18mm' },
    { id: 'p-back', name: '背板', quantity: 1, spec: '800×1080×3mm' },
    { id: 'p-dowel', name: '木榫', quantity: 12, spec: '8×30mm' },
    { id: 'p-cam', name: '偏心连接件', quantity: 8, spec: '15mm 三合一' },
    { id: 'p-pin', name: '层板托', quantity: 8, spec: '5mm 金属' },
    { id: 'p-screw', name: '十字自攻螺丝', quantity: 16, spec: '4×16mm' },
    { id: 'p-strap', name: '防倒支架', quantity: 2, spec: 'L 型含膨胀管' },
  ],
  tools: [
    { id: 't-driver', name: '十字螺丝刀', note: 'PH2' },
    { id: 't-hex', name: '内六角扳手', note: '4mm，随包装附带' },
    { id: 't-hammer', name: '橡胶锤' },
    { id: 't-tape', name: '卷尺', note: '3m 以上' },
    { id: 't-level', name: '水平仪' },
    { id: 't-pencil', name: '铅笔' },
  ],
  steps: [
    {
      id: 's1',
      title: '清点零件与工具',
      description:
        '打开包装，将零件按清单分组摆放在干净地面上，核对数量与外观。确认工具齐全后再开始组装。',
      illustration: 'layout',
      partIds: ['p-side', 'p-top', 'p-bottom', 'p-shelf', 'p-back', 'p-dowel', 'p-cam', 'p-pin', 'p-screw', 'p-strap'],
      toolIds: ['t-tape'],
      checkpoint: { text: '已对照材料表核对全部零件数量，且无破损、无划痕', required: true },
    },
    {
      id: 's2',
      title: '组装侧框',
      description:
        '将木榫敲入顶板、底板两端孔位，与两侧板对接；装入偏心连接件并用内六角扳手顺时针锁紧。用橡胶锤轻敲使接缝贴合。',
      illustration: 'frame',
      partIds: ['p-side', 'p-top', 'p-bottom', 'p-dowel', 'p-cam'],
      toolIds: ['t-hex', 't-hammer', 't-tape'],
      checkpoint: { text: '用卷尺测量两条对角线，误差不超过 3mm', required: true },
    },
    {
      id: 's3',
      title: '安装活动层板',
      description:
        '按需要的层高在侧板孔位插入层板托（每层 4 个），将两块层板平放到位。层高可日后调整。',
      illustration: 'shelf',
      partIds: ['p-shelf', 'p-pin'],
      toolIds: [],
      checkpoint: { text: '同一层的 4 个层板托处于同一高度', required: false },
    },
    {
      id: 's4',
      title: '固定背板',
      description:
        '将背板对齐柜体背面四边，先用四角螺丝定位，再沿边缘补齐其余螺丝。背板能保证柜体方正，请勿省略。',
      illustration: 'back',
      partIds: ['p-back', 'p-screw'],
      toolIds: ['t-driver', 't-pencil'],
      checkpoint: { text: '背板四边螺丝全部拧紧，柜体无晃动错位', required: true },
    },
    {
      id: 's5',
      title: '防倒固定与调平',
      description:
        '将书架移至预定位置贴墙，用水平仪调平；在墙体标记并安装防倒支架，将书架顶部与墙面连接固定。',
      illustration: 'anchor',
      partIds: ['p-strap'],
      toolIds: ['t-level', 't-pencil', 't-driver'],
      checkpoint: { text: '水平仪气泡居中，且防倒支架已连接墙体', required: true },
    },
    {
      id: 's6',
      title: '最终检查与完工',
      description:
        '全面检查所有连接点，轻摇书架确认稳固；撕除保护膜，清洁表面，将书籍上架（建议下层放重物）。',
      illustration: 'done',
      partIds: [],
      toolIds: [],
      checkpoint: { text: '摇晃测试无松动、无异响', required: true },
    },
  ],
};
