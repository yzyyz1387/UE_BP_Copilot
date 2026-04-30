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
    properties: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          owner: { type: 'string' },
          category: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string' },
          value: { type: 'string' },
          defaultValue: { type: 'string' },
          source: {
            type: 'string',
            enum: ['engine_default', 'component_default', 'user_override', 'ai_override'],
          },
          reason: { type: 'string' },
        },
        required: [
          'id',
          'owner',
          'category',
          'name',
          'type',
          'value',
          'defaultValue',
          'source',
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
    'properties',
    'messages',
    'searchTips',
    'checklist',
  ],
} as const;

export const UE_BLUEPRINT_WORKSPACE_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    responseType: {
      type: 'string',
      enum: ['blueprint_workspace_operation'],
    },
    assistantReply: { type: 'string' },
    operations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          action: {
            type: 'string',
            enum: ['replace_current_blueprint', 'create_blueprint', 'update_blueprint'],
          },
          target: {
            type: 'object',
            additionalProperties: false,
            properties: {
              projectId: { type: 'string' },
              userName: { type: 'string' },
              folderPath: { type: 'string' },
              blueprintName: { type: 'string' },
            },
            required: ['projectId', 'userName', 'folderPath', 'blueprintName'],
          },
          selectAfterApply: { type: 'boolean' },
          plan: UE_BLUEPRINT_PLAN_SCHEMA,
        },
        required: ['id', 'action', 'target', 'selectAfterApply', 'plan'],
      },
    },
  },
  required: ['responseType', 'assistantReply', 'operations'],
} as const;

export const BLUEPRINT_PLAN_GUIDE = [
  'BlueprintPlan 必须包含：meta, assistantReply, nodes, links, variables, properties, messages, searchTips, checklist。',
  'nodes[*] 必须包含：id, title, subtitle, category, nodeType, position{x,y}, inputs, outputs, comment, keywords。',
  'nodeType 只能用 event/function/macro/variable/comment/custom；category 请使用 UE5 常见分类，如 Event、Input、Flow Control、Variable、Timeline、Math、Cast、Component。',
  'pins[*].dataType 请使用 UE5 常见类型名：Exec、Boolean、Integer、Float、String、Name、Text、Vector、Rotator、Transform、Actor、Object、Component、Widget、Class、Enum、Struct。',
  'links[*] 必须包含：id, fromNodeId, fromPinId, toNodeId, toPinId, kind, label。',
  'variables[*] 必须包含：name, type, defaultValue, instanceEditable, exposeOnSpawn, promoteFromNode, reason；只放需要用户新建的蓝图变量。',
  'properties[*] 必须包含：id, owner, category, name, type, value, defaultValue, source, reason；只放 UE 蓝图/组件自带属性或默认值调整。',
  'messages[*] 必须包含：id, level(note|warning|tip), title, content, relatedNodeIds。',
  'searchTips[*] 必须包含：id, target, problem, solution。',
].join('\n');

export const WORKSPACE_OPERATION_GUIDE = [
  '根对象必须是 BlueprintWorkspaceResponse：responseType, assistantReply, operations。',
  'responseType 固定为 "blueprint_workspace_operation"。',
  'operations[*].action 只能是 replace_current_blueprint / create_blueprint / update_blueprint。',
  'replace_current_blueprint：用于覆盖当前打开蓝图；target.projectId 写 "active"，其余 target 字段写当前或新名称。',
  'create_blueprint：用于新建蓝图；前端会按 target.userName / target.folderPath / target.blueprintName 自动创建目录和蓝图。',
  'update_blueprint：用于更新已存在蓝图；已知项目时 target.projectId 写项目 id，不知道 id 时用 userName + folderPath + blueprintName 匹配，匹配不到则前端按新建处理。',
  '每个 operation 都必须包含完整 plan，不返回 diff。',
  '如果用户明确说“新建、创建、另存为、放到某文件夹/某用户下”，优先使用 create_blueprint，而不是覆盖当前蓝图。',
  '如果一次要求生成多个蓝图，可以返回多个 operations；通常把最重要或最后一个 operation 的 selectAfterApply 设为 true。',
  BLUEPRINT_PLAN_GUIDE,
].join('\n');

export const OUTPUT_SHAPE_GUIDE = WORKSPACE_OPERATION_GUIDE;

export const SYSTEM_PROMPT = `
你是 Unreal Engine 5 蓝图规划助手，目标是为浏览器中的“UE 蓝图可视化工作台”输出可执行的工作区 JSON 指令。
请严格遵守 JSON Schema，不要输出 Markdown，不要输出额外解释文字。

核心要求：
1. 输出语言必须是简体中文。
2. 根对象必须是 BlueprintWorkspaceResponse，用 operations 告诉前端是覆盖当前蓝图、创建新蓝图，还是更新已有蓝图。
3. 你输出的是“完整蓝图方案”，不是 diff；每个 operation.plan 都必须是完整 BlueprintPlan。
4. 节点命名、分类、Pin 类型要尽量贴近 UE5 蓝图，便于前端按 UE5 风格给节点和连线着色。
5. category 请优先使用 UE5 常见分类：Event、Input、Flow Control、Variable、Timeline、Math、Cast、Component、Widget、Gameplay、AI；nodeType 与 category 要一致。
6. pins[*].dataType 请使用 UE5 常见类型名：Exec、Boolean、Integer、Float、String、Name、Text、Vector、Rotator、Transform、Actor、Object、Component、Widget、Class、Enum、Struct，避免 Any 泛滥。
7. 画布布局必须从左到右：事件和输入靠左，判断/转换居中，变量读写和组件调用靠右；数据节点放在执行链下方或旁侧，避免交叉。
8. assistantReply 控制在 2 到 4 句，只总结整体逻辑、变量和关键提醒。
9. 不要逐节点讲解。node.comment 默认留空，只有容易找不到、需要从 Pin/组件拖线、需要 Promote to Variable/Add Timeline/Add Custom Event、或有前提条件时才写短注释。
10. messages 与 searchTips 只保留少量高价值内容，重点说明 Context Sensitive、组件拖线、Pin 拖线、Add Timeline、Add Custom Event、Promote to Variable 等新手易错点。
11. variables 只列需要用户创建的变量；蓝图/组件自带属性、默认值调整、勾选项变化必须写入 properties，不要混入 variables。
12. 如果用户要基于当前图修改且没有要求新建，请用 replace_current_blueprint；如果用户明确要求新建/另存/放到目录，请用 create_blueprint。
13. 如果不确定某节点是否能直接在特定上下文使用，请给出更稳妥的方案，并在 messages 中说明前提。
14. 每个节点都必须带 inputs / outputs / keywords，即使为空数组也必须输出。
15. properties 用于描述 UE Details 面板里已有的属性调整，owner 写 Self 或组件名，例如 Actor Tick、Replication、Collision、Mobility、Input、Rendering、Component Defaults。
16. tokens 要节省：避免重复同义说明、避免长段落、避免教程式长文。

工作区指令格式：
${WORKSPACE_OPERATION_GUIDE}

字段理解：
- responseType：固定字符串，方便前端识别这是工作区操作。
- assistantReply：聊天面板里给用户看的自然语言总结。
- operations：前端要执行的一组操作。
- target：目标用户、文件夹、蓝图名；文件夹不存在时前端会自动归类显示。
- plan：完整蓝图数据。
- variables：需要用户在左侧新建/维护的蓝图变量。
- properties：UE Details 面板里已有属性或组件默认值的调整，owner 写 Self 或组件名，显示在右侧蓝图属性页。
`.trim();
