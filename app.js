// ======================== 你的专属配置 ========================
const CONTRACT_ADDRESS = "0xb6Ea880874A6e920578a7EA8A712C5dFAC83569b"; // 你的合约地址
const SEPOLIA_CHAIN_ID = 11155111; // Sepolia测试网链ID

// ABI 将在页面加载时动态获取
let ABI = null;
// ==================================================================================

// 全局变量
let web3, currentAccount, rpsContract;
let currentGameId = null;
let currentCommitHash = null;
let selectedChoice = null; // 用户选择的出拳
let minBetWei = null; // 合约最小投注
let maxBetWei = null; // 合约最大投注

// 出拳对应的emoji
const choiceEmojis = ['✊', '✌️', '🖐️'];
const choiceTexts = ['石头', '剪刀', '布'];

// 智能格式化 ETH 显示（自动选择最佳单位）
function formatEth(weiValue) {
    if (!weiValue || weiValue === '0') return '0 ETH';
    
    const wei = BigInt(weiValue.toString());
    const eth = parseFloat(web3.utils.fromWei(weiValue.toString(), 'ether'));
    
    // 根据数值大小选择合适的单位
    if (eth >= 0.001) {
        // 大于 0.001 ETH，显示 ETH
        return `${eth.toFixed(6).replace(/\.?0+$/, '')} ETH`;
    } else if (eth >= 0.000001) {
        // 0.000001 ~ 0.001，显示 Gwei
        const gwei = eth * 1e9;
        return `${gwei.toFixed(3).replace(/\.?0+$/, '')} Gwei`;
    } else if (eth >= 1e-18) {
        // 更小的值，显示 wei
        return `${wei.toString()} wei`;
    } else {
        return '0 ETH';
    }
}

// 简洁版本：显示科学计数法或智能单位
function formatEthSmart(weiValue) {
    if (!weiValue || weiValue === '0') return '0';
    
    const eth = parseFloat(web3.utils.fromWei(weiValue.toString(), 'ether'));
    
    if (eth === 0) return '0';
    if (eth >= 0.0001) {
        return eth.toFixed(6).replace(/\.?0+$/, '');
    } else {
        // 使用科学计数法，保留有效数字
        return eth.toExponential(2);
    }
}

// 页面加载完成初始化
window.onload = async () => {
    if (window.ethereum) {
        web3 = new Web3(window.ethereum);
        
        // 动态加载 ABI 文件
        try {
            const response = await fetch('./abi.json');
            ABI = await response.json();
            console.log("✅ ABI加载成功");
        } catch (err) {
            console.error("❌ ABI加载失败:", err);
            alert("❌ ABI文件加载失败，请确保abi.json文件存在！");
            return;
        }
        
        bindAllButtonEvents(); // 绑定所有按钮点击事件
        console.log("✅ Web3初始化完成，等待连接钱包");
    } else {
        alert("❌ 请先安装MetaMask钱包插件！");
    }
};

// 绑定所有按钮事件
function bindAllButtonEvents() {
    document.getElementById("connectBtn").onclick = connectWallet;
    document.getElementById("fightBtn").onclick = startGame;
    document.getElementById("queryRecordBtn").onclick = queryMyRecord;
}

// 选择出拳
function selectChoice(choice) {
    console.log("🎯 selectChoice 被调用，选择:", choice);
    selectedChoice = choice;
    
    // 更新按钮样式
    document.querySelectorAll('.choice-btn').forEach((btn, index) => {
        if (index === choice) {
            btn.classList.add('selected');
            console.log("✅ 按钮", index, "添加 selected 样式");
        } else {
            btn.classList.remove('selected');
        }
    });
    
    // 更新玩家出拳显示
    document.getElementById('playerChoiceDisplay').innerText = choiceEmojis[choice];
    console.log("✅ 更新玩家出拳显示:", choiceEmojis[choice]);
    
    // 启用出拳按钮
    document.getElementById('fightBtn').disabled = false;
    console.log("✅ 出拳按钮已启用");
}

// ✅ 1. 连接MetaMask钱包 + 自动切换Sepolia测试网
async function connectWallet() {
    try {
        // 请求钱包授权
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        currentAccount = accounts[0];
        const currentChainId = await web3.eth.getChainId();

        // 自动切换到Sepolia测试网（如果不在）
        if (Number(currentChainId) !== SEPOLIA_CHAIN_ID) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x' + SEPOLIA_CHAIN_ID.toString(16) }]
                });
            } catch (switchError) {
                // 如果网络不存在，添加网络
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: '0x' + SEPOLIA_CHAIN_ID.toString(16),
                            chainName: 'Sepolia Testnet',
                            nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
                            rpcUrls: ['https://sepolia.infura.io/v3/'],
                            blockExplorerUrls: ['https://sepolia.etherscan.io']
                        }]
                    });
                }
            }
        }

        // 初始化合约实例 (核心：连接你的合约)
        rpsContract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);

        // 获取合约的投注限制
        try {
            minBetWei = await rpsContract.methods.MIN_BET_ETH().call();
            maxBetWei = await rpsContract.methods.MAX_BET_ETH().call();
            
            console.log(`📊 合约投注限制(wei): MIN=${minBetWei}, MAX=${maxBetWei}`);
            
            // 使用智能格式化显示
            const minDisplay = formatEth(minBetWei);
            const maxDisplay = formatEth(maxBetWei);
            
            console.log(`📊 合约投注限制: ${minDisplay} - ${maxDisplay}`);
            
            // 更新输入框限制（使用 wei 单位）
            const betInput = document.getElementById('betWei');
            betInput.min = minBetWei.toString();
            betInput.max = maxBetWei.toString();
            betInput.value = minBetWei.toString(); // 默认为最小投注
            betInput.step = "1";
            betInput.placeholder = `投注 ${minBetWei}~${maxBetWei} wei`;
            
            // 显示投注范围给用户
            updateGameStatus(`💰 投注范围: ${minBetWei} ~ ${maxBetWei} wei (${minDisplay} ~ ${maxDisplay})`);
            
            // 更新侧边提示面板
            const sideMinEl = document.getElementById('sideMinBet');
            const sideMaxEl = document.getElementById('sideMaxBet');
            if (sideMinEl) sideMinEl.textContent = `${minBetWei} wei`;
            if (sideMaxEl) sideMaxEl.textContent = `${maxBetWei} wei`;
        } catch (e) {
            console.error('❌ 获取合约参数失败:', e);
            updateGameStatus("⚠️ 无法获取合约投注限制，使用默认值");
            // 使用默认值
            const betInput = document.getElementById('betWei');
            betInput.min = "1";
            betInput.max = "100000000000000000";
            betInput.value = "1";
        }

        // 检查合约余额（合约需要有足够ETH支付奖金）
        const contractBalance = await web3.eth.getBalance(CONTRACT_ADDRESS);
        const contractEth = web3.utils.fromWei(contractBalance, 'ether');
        console.log(`📊 合约余额: ${contractEth} ETH`);
        
        if (parseFloat(contractEth) < 0.002) {
            updateGameStatus("⚠️ 警告：合约余额不足，可能无法支付奖金！");
            console.warn("⚠️ 合约余额过低，玩家获胜时可能无法支付奖金");
        }

        // 更新页面钱包信息
        const shortAddr = currentAccount.slice(0, 6) + '...' + currentAccount.slice(-4);
        document.getElementById("walletAddr").innerText = shortAddr;
        const walletBalance = web3.utils.fromWei(await web3.eth.getBalance(currentAccount), "ether");
        document.getElementById("walletBal").innerText = `${parseFloat(walletBalance).toFixed(4)} ETH`;

        // 更新按钮状态
        const connectBtn = document.getElementById("connectBtn");
        connectBtn.innerText = "✅ 已连接";
        connectBtn.classList.add("connected");

        updateGameStatus("✅ 钱包已连接，请选择出拳！");
        
        // 自动查询战绩
        queryMyRecord();
    } catch (err) {
        alert(`❌ 连接失败：${err.message}`);
    }
}

// ✅ 2. 开始游戏（一键完成：创建游戏 + 生成哈希 + 提交 + 开奖）
async function startGame() {
    if (!currentAccount) return alert("❌ 请先连接钱包！");
    if (selectedChoice === null) return alert("❌ 请先选择出拳！");
    
    const betWeiInput = document.getElementById("betWei").value;
    // 确保salt是数字类型
    let salt = document.getElementById("randomSalt").value;
    if (!salt || salt === '') {
        salt = Math.floor(Math.random() * 1000000);
        document.getElementById("randomSalt").value = salt;
    } else {
        salt = parseInt(salt);
    }
    
    // 直接使用 wei 值
    const betWei = betWeiInput.toString();
    if (!betWei || betWei === '0') {
        return alert("❌ 请输入有效的投注金额！");
    }
    
    // 检查投注金额是否在合约允许范围内
    if (minBetWei && maxBetWei) {
        const betWeiBN = BigInt(betWei);
        const minBN = BigInt(minBetWei);
        const maxBN = BigInt(maxBetWei);
        if (betWeiBN < minBN || betWeiBN > maxBN) {
            return alert(`❌ 投注金额必须在 ${minBetWei} ~ ${maxBetWei} wei 之间！`);
        }
    }
    
    // 检查钱包余额是否足够
    const walletBalance = await web3.eth.getBalance(currentAccount);
    if (BigInt(walletBalance) < BigInt(betWei)) {
        return alert("❌ 钱包ETH余额不足！");
    }
    
    const fightBtn = document.getElementById("fightBtn");
    const originalBtnText = fightBtn.innerText;
    
    // 按钮状态更新函数
    function updateBtnStatus(text) {
        fightBtn.innerText = text;
    }
    
    try {
        fightBtn.classList.add("loading");
        fightBtn.disabled = true;
        updateBtnStatus("⏳ 准备中...");
        
        // 播放出拳动画
        playBattleAnimation();
        
        // 详细的诊断日志
        console.log("========== 游戏开始诊断 ==========");
        console.log(`📍 玩家地址: ${currentAccount}`);
        console.log(`📍 合约地址: ${CONTRACT_ADDRESS}`);
        console.log(`💰 投注金额: ${betWei} wei (${formatEth(betWei)})`);
        console.log(`✊ 玩家选择: ${selectedChoice} (${choiceTexts[selectedChoice]})`);
        console.log(`🔑 随机盐值: ${salt}`);
        
        if (minBetWei && maxBetWei) {
            console.log(`📊 合约MIN_BET: ${minBetWei} wei (${formatEth(minBetWei)})`);
            console.log(`📊 合约MAX_BET: ${maxBetWei} wei (${formatEth(maxBetWei)})`);
            console.log(`📊 投注是否在范围内: ${BigInt(betWei) >= BigInt(minBetWei) && BigInt(betWei) <= BigInt(maxBetWei)}`);
        }
        console.log("====================================");
        
        updateGameStatus("⏳ 正在创建游戏...");
        updateBtnStatus("🎮 创建游戏中...");
        
        // 第一步：创建游戏
        console.log("📤 发送createGame交易...");
        const txResult = await rpsContract.methods.createGame().send({
            from: currentAccount,
            value: betWei,
            gas: 300000
        });
        console.log("✅ createGame交易成功:", txResult);
        
        // 从事件或返回值获取gameId
        if (txResult.events && txResult.events.GameCreated) {
            currentGameId = txResult.events.GameCreated.returnValues.gameId;
        } else {
            // 如果事件解析失败，尝试从logs解析
            console.log('交易结果:', txResult);
            throw new Error('无法获取游戏ID，请检查交易日志');
        }
        console.log(`游戏创建成功, GameId=${currentGameId}`);
        
        updateGameStatus("⏳ 正在生成哈希承诺...");
        updateBtnStatus("🔐 生成承诺中...");
        
        // 第二步：生成哈希承诺 - 与合约算法一致: keccak256(abi.encodePacked(choice, salt))
        // choice是uint8类型，salt是uint256类型
        currentCommitHash = web3.utils.soliditySha3(
            { type: 'uint8', value: selectedChoice },
            { type: 'uint256', value: salt }
        );
        console.log(`哈希承诺: ${currentCommitHash}`);
        
        updateGameStatus("⏳ 正在提交哈希...");
        updateBtnStatus("📤 提交承诺中...");
        
        // 第三步：提交哈希
        await rpsContract.methods.submitCommit(currentGameId, currentCommitHash).send({
            from: currentAccount,
            gas: 200000
        });
        console.log('哈希提交成功');
        
        updateGameStatus("⏳ 正在开奖结算...");
        updateBtnStatus("🎰 开奖中...");
        
        // 第四步：揭示并结算
        const revealResult = await rpsContract.methods.revealChoice(
            currentGameId, 
            selectedChoice,  // uint8
            salt             // uint256
        ).send({
            from: currentAccount,
            gas: 500000
        });
        console.log('开奖结果:', revealResult);
        
        // 获取开奖结果
        const aiChoice = revealResult.events.ChoiceRevealed.returnValues.aiChoice;
        const isWin = revealResult.events.GameSettled.returnValues.isWin;
        const isDraw = revealResult.events.GameSettled.returnValues.isDraw;
        
        // 显示电脑出拳
        document.getElementById('aiChoiceDisplay').innerText = choiceEmojis[aiChoice];
        document.getElementById('aiChoiceDisplay').classList.add('punch');
        
        // 显示结果
        const resultDisplay = document.getElementById('resultDisplay');
        resultDisplay.classList.remove('hidden', 'win', 'lose', 'draw');
        
        if (isDraw) {
            resultDisplay.classList.add('draw');
            resultDisplay.innerText = "🤝 平局！已退款";
            updateGameStatus("🤝 平局！投注已全额退还");
            updateBtnStatus("🤝 平局");
        } else if (isWin) {
            resultDisplay.classList.add('win');
            resultDisplay.innerText = "🎉 恭喜获胜！";
            updateGameStatus("🏆 恭喜获胜！获得双倍奖励");
            updateBtnStatus("🎉 获胜！");
            // 播放烟花动画
            playFireworks();
        } else {
            resultDisplay.classList.add('lose');
            resultDisplay.innerText = `😢 很遗憾... -${betWei} wei`;
            updateBtnStatus("😢 落败");
            updateGameStatus(`💸 本局损失: ${betWei} wei (${formatEth(betWei)})`);
            // 显示鼓励弹窗，传入损失金额
            showEncourageModal(betWei);
        }
        
        // 刷新余额和战绩
        const walletBalance = web3.utils.fromWei(await web3.eth.getBalance(currentAccount), "ether");
        document.getElementById("walletBal").innerText = `${parseFloat(walletBalance).toFixed(4)} ETH`;
        queryMyRecord();
        
    } catch (err) {
        console.error("❌ 游戏失败详情:", err);
        
        // 详细分析错误原因
        let errorMessage = err.message;
        let suggestion = "";
        
        if (err.message.includes("revert") || err.message.includes("reverted")) {
            console.log("🔍 检测到EVM回滚，分析可能原因...");
            
            // 检查是否是投注金额问题
            if (minBetWei && maxBetWei) {
                const betBigInt = BigInt(betWei);
                const minBigInt = BigInt(minBetWei);
                const maxBigInt = BigInt(maxBetWei);
                
                if (betBigInt < minBigInt) {
                    suggestion = `投注金额 ${betWei} wei 小于最小限制 ${minBetWei} wei`;
                } else if (betBigInt > maxBigInt) {
                    suggestion = `投注金额 ${betWei} wei 大于最大限制 ${maxBetWei} wei`;
                }
            }
            
            // 检查合约余额
            if (!suggestion) {
                try {
                    const contractBal = await web3.eth.getBalance(CONTRACT_ADDRESS);
                    const betAmount = BigInt(betWei);
                    const prize = betAmount * 2n;
                    if (BigInt(contractBal) < prize) {
                        suggestion = `合约余额不足以支付奖金。合约余额: ${formatEth(contractBal)}，需要: ${formatEth(prize.toString())}`;
                    }
                } catch (e) {
                    console.error("无法检查合约余额:", e);
                }
            }
            
            if (suggestion) {
                errorMessage = suggestion;
            }
        }
        
        alert(`❌ 游戏失败：${errorMessage}`);
        updateGameStatus("❌ 游戏出错，请重试");
        updateBtnStatus("❌ 出错了");
    } finally {
        // 短暂延迟后恢复按钮状态
        setTimeout(() => {
            fightBtn.classList.remove("loading");
            fightBtn.disabled = false;
            fightBtn.innerText = "👊 出拳对战！";
        }, 1500);
        
        // 移除动画类
        setTimeout(() => {
            document.getElementById('aiChoiceDisplay').classList.remove('punch');
        }, 600);
    }
}

// 播放对战动画
function playBattleAnimation() {
    const playerDisplay = document.getElementById('playerChoiceDisplay');
    const aiDisplay = document.getElementById('aiChoiceDisplay');
    
    // 重置电脑显示
    aiDisplay.innerText = '❓';
    
    // 添加摇动动画
    playerDisplay.classList.add('shake');
    aiDisplay.classList.add('shake');
    
    // 隐藏之前的结果
    document.getElementById('resultDisplay').classList.add('hidden');
    
    setTimeout(() => {
        playerDisplay.classList.remove('shake');
        aiDisplay.classList.remove('shake');
    }, 500);
}

// 播放烟花动画
function playFireworks() {
    const container = document.getElementById('fireworks-container');
    const colors = ['#ff0', '#f0f', '#0ff', '#f00', '#0f0', '#00f', '#ff6b6b', '#4ecdc4'];
    
    for (let i = 0; i < 8; i++) {
        setTimeout(() => {
            const x = Math.random() * window.innerWidth;
            const y = Math.random() * window.innerHeight * 0.6;
            
            // 创建烟花中心
            const firework = document.createElement('div');
            firework.className = 'firework';
            firework.style.left = x + 'px';
            firework.style.top = y + 'px';
            firework.style.background = colors[Math.floor(Math.random() * colors.length)];
            container.appendChild(firework);
            
            // 创建火花
            for (let j = 0; j < 12; j++) {
                const spark = document.createElement('div');
                spark.className = 'spark';
                spark.style.left = x + 'px';
                spark.style.top = y + 'px';
                spark.style.background = colors[Math.floor(Math.random() * colors.length)];
                
                const angle = (j / 12) * Math.PI * 2;
                const distance = 50 + Math.random() * 100;
                const endX = Math.cos(angle) * distance;
                const endY = Math.sin(angle) * distance;
                
                spark.style.setProperty('--end-x', endX + 'px');
                spark.style.setProperty('--end-y', endY + 'px');
                spark.style.animation = `spark 1.2s ease-out forwards`;
                spark.style.transform = `translate(${endX}px, ${endY}px)`;
                
                container.appendChild(spark);
            }
            
            // 清理
            setTimeout(() => {
                firework.remove();
            }, 1000);
        }, i * 200);
    }
    
    // 清理所有火花
    setTimeout(() => {
        container.innerHTML = '';
    }, 3000);
}

// 显示鼓励弹窗
function showEncourageModal(lossWei) {
    const modal = document.getElementById('encourage-modal');
    const lossDisplay = document.getElementById('lossDisplay');
    if (lossWei) {
        lossDisplay.innerText = `本局损失: ${lossWei} wei`;
    } else {
        lossDisplay.innerText = '';
    }
    modal.classList.remove('hidden');
}

// 关闭鼓励弹窗
function closeEncourageModal() {
    document.getElementById('encourage-modal').classList.add('hidden');
}

// 更新游戏状态
function updateGameStatus(msg) {
    document.getElementById('gameStatus').innerText = msg;
}

// ✅ 查询我的战绩
async function queryMyRecord() {
    if (!currentAccount || !rpsContract) return;
    try {
        // Web3.js 返回对象格式，使用属性访问而非数组解构
        const result = await rpsContract.methods
            .getPlayerFullRecord(currentAccount)
            .call();
        
        // 返回值按索引访问: 0=win, 1=lose, 2=draw, 3=total, 4=winEth, 5=betEth
        const win = result[0];
        const lose = result[1];
        const draw = result[2];
        const total = result[3];
        const winEth = result[4];
        const betEth = result[5];
        
        console.log("📊 战绩查询结果:", { win, lose, draw, total, winEth, betEth });
        
        document.getElementById("recordShow").innerText = 
            `🏆 胜:${win} | 😢 负:${lose} | 🤝 平:${draw} | 累计赢:${formatEth(winEth)}`;
    } catch (err) {
        console.error("查询战绩失败:", err);
    }
}