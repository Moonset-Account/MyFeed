import type { AssemblyPlan } from '../types';

/** 示例方案：虚构产品「云杉·四层书架 BS-400」 */
export const samplePlan: AssemblyPlan = {
  id: 'plan-bs400',
  name: '云杉·四层书架 BS-400',
  description:
    '虚构示例产品。四层开放式书架，宽约 80cm、高约 140cm，适合两人协作组装，预计 45 分钟。',
  parts: [
    { id: 'p-side', code: 'A01', name: '侧板', quantity: 2, unit: '块' },
    { id: 'p-shelf', code: 'A02', name: '层板', quantity: 4, unit: '块' },
    { id: 'p-top', code: 'A03', name: '顶板', quantity: 1, unit: '块' },
    { id: 'p-back', code: 'A04', name: '背板', quantity: 1, unit: '张' },
    { id: 'p-dowel', code: 'B01', name: '木榫 8×30mm', quantity: 16, unit: '根' },
    { id: 'p-screw', code: 'B02', name: '沉头螺丝 M6×40', quantity: 12, unit: '颗' },
    { id: 'p-cam', code: 'B03', name: '偏心连接件', quantity: 8, unit: '套' },
    { id: 'p-nail', code: 'B04', name: '背板钉 20mm', quantity: 20, unit: '枚' },
    { id: 'p-pad', code: 'C01', name: '防滑脚垫', quantity: 4, unit: '个' },
  ],
  tools: [
    { id: 't-driver', name: '十字螺丝刀', note: 'PH2 批头' },
    { id: 't-hex', name: '内六角扳手', note: '4mm，随包装附带' },
    { id: 't-hammer', name: '橡胶锤', note: '敲入木榫用，勿用铁锤直接敲击' },
    { id: 't-tape', name: '卷尺', note: '核对孔位间距' },
    { id: 't-level', name: '水平仪', note: '校准层板与整体垂直度' },
  ],
  steps: [
    {
      id: 's1',
      title: '开箱核对零件',
      description:
        '打开包装，将零件按编号分组摆放，对照材料表逐项清点数量。发现缺件请立即使用「报告缺件」登记，系统会暂停流程并生成补件清单。',
      imageKey: 'unbox',
      imageAlt: '示意图：打开的包装箱旁整齐摆放着编号的板材与五金包',
      parts: [],
      toolIds: ['t-tape'],
      checkpoints: [
        { id: 's1-c1', text: '对照材料表清点全部零件，数量一致', required: true },
        { id: 's1-c2', text: '检查板材表面无裂纹、无磕碰', required: true },
        { id: 's1-c3', text: '准备一块干净地毯或纸板作为作业面', required: false },
      ],
    },
    {
      id: 's2',
      title: '侧板预装木榫',
      description:
        '将两块侧板平放，凹槽一侧朝上。在每块侧板的 8 个榫孔中敲入木榫，露出约 12mm。木榫应与板面垂直，敲击时垫一块废木板保护表面。',
      imageKey: 'dowel',
      imageAlt: '示意图：侧板平放，榫孔中垂直插入木榫，橡胶锤悬在上方',
      parts: [
        { partId: 'p-side', quantity: 2 },
        { partId: 'p-dowel', quantity: 16 },
      ],
      toolIds: ['t-hammer'],
      checkpoints: [
        { id: 's2-c1', text: '确认侧板凹槽朝向正确（朝内、朝上）', required: true },
        { id: 's2-c2', text: '16 根木榫全部敲入且与板面垂直', required: true },
      ],
    },
    {
      id: 's3',
      title: '安装底层与中间层板',
      description:
        '将层板两端的榫孔对准一侧侧板的木榫推入，再扣合另一侧侧板。从底层开始逐层向上安装，每层推入后用卷尺核对层板前端平齐。',
      imageKey: 'shelf',
      imageAlt: '示意图：两块侧板之间水平嵌入层板，卷尺测量前端平齐度',
      parts: [{ partId: 'p-shelf', quantity: 3 }],
      toolIds: ['t-hammer', 't-tape'],
      checkpoints: [
        { id: 's3-c1', text: '层板封边条一侧朝前', required: true },
        { id: 's3-c2', text: '各层板前端与侧板前缘平齐，误差小于 2mm', required: true },
        { id: 's3-c3', text: '榫头完全入孔，无外露缝隙', required: false },
      ],
    },
    {
      id: 's4',
      title: '安装顶板与偏心连接件',
      description:
        '在顶板两端安装偏心连接件：先将连接杆拧入顶板预埋螺母，再将顶板扣合到两侧板顶端，用内六角扳手顺时针旋转偏心轮 180° 锁紧。',
      imageKey: 'camlock',
      imageAlt: '示意图：顶板扣合在侧板顶端，内六角扳手旋转偏心轮锁紧',
      parts: [
        { partId: 'p-top', quantity: 1 },
        { partId: 'p-cam', quantity: 8 },
      ],
      toolIds: ['t-hex'],
      checkpoints: [
        { id: 's4-c1', text: '偏心轮箭头朝向连接杆插入方向', required: true },
        { id: 's4-c2', text: '8 套连接件全部锁紧，顶板无晃动', required: true },
      ],
    },
    {
      id: 's5',
      title: '固定剩余层板螺丝',
      description:
        '从侧板外侧的沉孔中拧入 M6×40 沉头螺丝，每块层板两端各 2 颗。螺丝拧紧至与板面平齐即可，过度拧紧会导致板材开裂。',
      imageKey: 'screws',
      imageAlt: '示意图：十字螺丝刀将沉头螺丝拧入侧板外侧沉孔',
      parts: [{ partId: 'p-screw', quantity: 12 }],
      toolIds: ['t-driver'],
      checkpoints: [
        { id: 's5-c1', text: '12 颗螺丝全部拧入且头部与板面平齐', required: true },
        { id: 's5-c2', text: '板面无因过度拧紧产生的裂纹', required: true },
      ],
    },
    {
      id: 's6',
      title: '安装背板',
      description:
        '将书架正面朝下平放，背板对准背面凹槽推入，先固定四角再沿边缘每隔约 15cm 钉入背板钉。背板能校正整体方正，钉装前务必先对角线测量。',
      imageKey: 'backpanel',
      imageAlt: '示意图：书架正面朝下，背板嵌入背面凹槽，四角先钉定位',
      parts: [
        { partId: 'p-back', quantity: 1 },
        { partId: 'p-nail', quantity: 20 },
      ],
      toolIds: ['t-hammer', 't-tape'],
      checkpoints: [
        { id: 's6-c1', text: '两条对角线长度差小于 5mm（框架方正）', required: true },
        { id: 's6-c2', text: '背板四边全部入槽，无翘起', required: true },
      ],
    },
    {
      id: 's7',
      title: '粘贴脚垫并立起',
      description:
        '在侧板底部四角粘贴防滑脚垫，两人协作将书架缓慢立起并移动到目标位置。移动时抬离地面，不要拖拽。',
      imageKey: 'pads',
      imageAlt: '示意图：侧板底部四角贴上圆形脚垫，两人合力扶起书架',
      parts: [{ partId: 'p-pad', quantity: 4 }],
      toolIds: [],
      checkpoints: [
        { id: 's7-c1', text: '4 个脚垫粘贴牢固、位置对称', required: false },
        { id: 's7-c2', text: '书架立起过程由两人配合完成', required: true },
      ],
    },
    {
      id: 's8',
      title: '整体校验与完工',
      description:
        '用水平仪检查书架前后、左右方向的水平度，必要时在脚垫下垫入垫片微调。逐层摇晃测试稳定性，确认无松动后擦净表面，组装完成。',
      imageKey: 'done',
      imageAlt: '示意图：立好的四层书架，顶部放着水平仪，气泡居中',
      parts: [],
      toolIds: ['t-level'],
      checkpoints: [
        { id: 's8-c1', text: '水平仪气泡在两个方向均居中', required: true },
        { id: 's8-c2', text: '用力摇晃书架无松动、无异响', required: true },
        { id: 's8-c3', text: '书架已远离热源并建议固定防倾倒', required: false },
      ],
    },
  ],
};
