export const UE_BLUEPRINT_PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    meta: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
        blueprintType: { type: 'string' },
        ueVersion: { type: 'string' },
        targetUser: { type: 'string' },
        sceneContext: { type: 'string' },
      },
      required: [
        'title',
        'summary',
        'blueprintType',
        'ueVersion',
        'targetUser',
        'sceneContext',
      ],
    },
    assistantReply: { type: 'string' },
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          subtitle: { type: 'string' },
          category: { type: 'string' },
          nodeType: {
            type: 'string',
            enum: ['event', 'function', 'macro', 'variable', 'comment', 'custom'],
          },
          position: {
            type: 'object',
            additionalProperties: false,
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
            },
            required: ['x', 'y'],
          },
          inputs: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                kind: { type: 'string', enum: ['exec', 'data'] },
                dataType: { type: 'string' },
              },
              required: ['id', 'label', 'kind', 'dataType'],
            },
          },
          outputs: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                kind: { type: 'string', enum: ['exec', 'data'] },
                dataType: { type: 'string' },
              },
              required: ['id', 'label', 'kind', 'dataType'],
            },
          },
          comment: { type: 'string' },
          keywords: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: [
          'id',
          'title',
          'subtitle',
          'category',
          'nodeType',
          'position',
          'inputs',
          'outputs',
          'comment',
          'keywords',
        ],
      },
    },
    links: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          fromNodeId: { type: 'string' },
          fromPinId: { type: 'string' },
          toNodeId: { type: 'string' },
          toPinId: { type: 'string' },
          kind: { type: 'string', enum: ['exec', 'data'] },
          label: { type: 'string' },
        },
        required: [
          'id',
          'fromNodeId',
          'fromPinId',
          'toNodeId',
          'toPinId',
          'kind',
          'label',
        ],
      },
    },
    variables: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          type: { type: 'string' },
          defaultValue: { type: 'string' },
          instanceEditable: { type: 'boolean' },
          exposeOnSpawn: { type: 'boolean' },
          promoteFromNode: { type: 'string' },
          reason: { type: 'string' },
        },
        required: [
          'name',
          'type',
          'defaultValue',
          'instanceEditable',
          'exposeOnSpawn',
          'promoteFromNode',
          'reason',
        ],
      },
    },
    messages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          level: { type: 'string', enum: ['note', 'warning', 'tip'] },
          title: { type: 'string' },
          content: { type: 'string' },
          relatedNodeIds: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['id', 'level', 'title', 'content', 'relatedNodeIds'],
      },
    },
    searchTips: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          target: { type: 'string' },
          problem: { type: 'string' },
          solution: { type: 'string' },
        },
        required: ['id', 'target', 'problem', 'solution'],
      },
    },
    checklist: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: [
    'meta',
    'assistantReply',
    'nodes',
    'links',
    'variables',
    'messages',
    'searchTips',
    'checklist',
  ],
} as const;

export const OUTPUT_SHAPE_GUIDE = [
  '只返回一个 JSON 对象。',
  '字段必须包含：meta, assistantReply, nodes, links, variables, messages, searchTips, checklist。',
  'nodes[*] 必须包含：id, title, subtitle, category, nodeType, position{x,y}, inputs, outputs, comment, keywords。',
  'links[*] 必须包含：id, fromNodeId, fromPinId, toNodeId, toPinId, kind, label。',
  'variables[*] 必须包含：name, type, defaultValue, instanceEditable, exposeOnSpawn, promoteFromNode, reason。',
  'messages[*] 必须包含：id, level(note|warning|tip), title, content, relatedNodeIds。',
  'searchTips[*] 必须包含：id, target, problem, solution。',
].join('\n');

export const SYSTEM_PROMPT = `
你是 Unreal Engine 5 蓝图规划助手，目标是为一个浏览器中的“UE 蓝图可视化网页”输出结构化数据。
请严格遵守 JSON Schema，不要输出 Markdown，不要输出额外解释文字。

核心要求：
1. 输出语言必须是简体中文。
2. 你输出的是“完整蓝图方案”，不是 diff。
3. 节点要尽量符合 UE5 蓝图命名与常见用法。
4. 画布布局必须从左到右，坐标尽量规整，避免大量交叉连线。
5. assistantReply 必须简短，控制在 2 到 4 句，只总结整体逻辑、变量和关键提醒。
6. 不要对每个节点逐一解释。node.comment 默认留空，只有以下情况才填写简短注释：
   - 容易找不到的节点
   - 需要从 Pin / 组件拖线才能添加
   - 需要 Promote to Variable / Add Timeline / Add Custom Event
   - 有明显前提条件或易错点
7. messages 与 searchTips 只保留少量高价值内容，避免重复表达同一件事。
8. 新手提醒非常重要：如果某些节点通常不能在空白处直接搜索到，请在 messages 或 searchTips 中明确说明：
   - 需要从组件引用拖线再搜
   - 需要从某个 Pin 拖线再搜
   - 需要先右键 Add Timeline / Add Custom Event / Promote to Variable
   - 需要打开或关闭 Context Sensitive 来排查
9. variables 中要明确哪些变量建议提升、是否建议 Instance Editable、是否建议 Expose on Spawn。
10. 如果用户要基于当前图修改，请保留合理的既有结构；如果用户要重做，也可以整体重构。
11. 如果你不确定某个节点是否能直接在特定上下文使用，请优先给出更稳妥的蓝图规划，并在 messages 中说明前提条件。
12. 节点要可视化友好：事件节点靠左，执行链逐步向右，数据节点可在执行链下方或旁侧。
13. 每个节点都必须带上 inputs / outputs / keywords，即使为空数组也必须输出。
14. tokens 要节省：避免重复同义说明、避免长段落、避免逐节点教学。

字段理解：
- meta：蓝图概览
- assistantReply：聊天面板里给用户看的自然语言总结
- nodes：蓝图节点
- links：节点连接线
- variables：建议添加或提升的变量
- messages：备注、警告、提示
- searchTips：找不到节点时的补充说明
- checklist：用户在 UE 里实际落地时要检查的事项
`.trim();
