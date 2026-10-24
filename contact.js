// EmailJS配置
// 在生产环境中使用前需要初始化EmailJS
(function() {
    // 确保EmailJS已加载
    if (typeof emailjs !== 'undefined') {
        // 使用您的EmailJS公共密钥初始化
        emailjs.init("HEfV0J3Dsa4mJbsjr"); // 使用正确的公钥而非服务ID
        console.log("EmailJS已初始化");
    } else {
        console.warn("EmailJS未加载，将使用备用发送方式");
    }
})();

// 表单提交处理函数
function submitContactForm(event) {
    event.preventDefault();
    console.log("表单提交被触发");
    
    // 获取表单数据
    const form = document.getElementById('contactForm');
    const submitBtn = document.querySelector('.submit-button'); // 直接使用类选择器
    const formStatus = document.getElementById('formStatus');
    
    // 检查元素是否存在
    if (!form) {
        console.error("找不到contactForm表单");
        alert("找不到contactForm表单");
        return false;
    }
    
    if (!submitBtn) {
        console.error("找不到提交按钮");
        alert("找不到提交按钮");
        return false;
    }
    
    if (!formStatus) {
        console.error("找不到formStatus元素");
        // 创建状态元素
        const newFormStatus = document.createElement('div');
        newFormStatus.id = 'formStatus';
        newFormStatus.style.display = 'none';
        newFormStatus.style.marginTop = '20px';
        newFormStatus.style.borderRadius = '8px';
        newFormStatus.style.padding = '12px';
        form.parentElement.appendChild(newFormStatus);
        console.log("已创建formStatus元素");
    }
    
    // 保存原始按钮文本，用于稍后恢复
    const originalButtonHtml = submitBtn.innerHTML;
    
    // 禁用提交按钮，防止重复提交
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '提交中...';
        
        // 获取表单字段
        const name = form.name.value;
        const phone = form.phone.value;
        const email = form.email.value;
        const subject = form.subject.value; // 注意：HTML中字段名为subject
        const message = form.message.value;
        
        console.log("表单数据:", { name, phone, email, subject, message });
        
        // 准备发送的数据
        const formData = {
            from_name: name,
            phone: phone,
            reply_to: email,
            email: email,
            subject: subject,
            message: message
        };
        
        // 首先尝试使用EmailJS发送
        if (typeof emailjs !== 'undefined') {
            console.log("尝试使用EmailJS发送邮件...");
            
            // 显示发送状态
            formStatus.innerHTML = '<div class="alert alert-info" style="background-color:#cce5ff;color:#004085;padding:10px;border-radius:5px;">正在发送邮件，请稍候...</div>';
            formStatus.style.display = 'block';
            
            // 使用EmailJS服务发送邮件
            emailjs.send('service_4tn9tjn', 'template_8j3qjzi', formData)
                .then(function(response) {
                    console.log('邮件发送成功:', response);
                    formStatus.innerHTML = '<div class="alert alert-success" style="background-color:#d4edda;color:#155724;padding:10px;border-radius:5px;">提交成功！我们会尽快与您联系。</div>';
                    formStatus.style.display = 'block';
                    form.reset();
                    
                    // 恢复提交按钮状态
                    setTimeout(() => {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalButtonHtml;
                    }, 2000);
                })
                .catch(function(error) {
                    console.error('EmailJS发送失败，尝试备用方法:', error);
                    // 使用备用方法
                    sendFormDataToServer(formData);
                });
        } else {
            // 如果EmailJS未加载，直接使用备用方法
            console.log("EmailJS未加载，使用备用方法");
            sendFormDataToServer(formData);
        }
    } catch (error) {
        console.error("处理表单时出错:", error);
        
        // 恢复按钮状态
        setTimeout(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalButtonHtml;
            
            // 显示错误消息
            if (formStatus) {
                formStatus.innerHTML = '<div class="alert alert-danger" style="background-color:#f8d7da;color:#721c24;padding:10px;border-radius:5px;">提交失败，请稍后再试。错误信息: ' + error.message + '</div>';
                formStatus.style.display = 'block';
            } else {
                alert("表单提交失败: " + error.message);
            }
        }, 1000);
    }
    
    return false;
}

// 备用方法：通过服务器发送表单数据
function sendFormDataToServer(formData) {
    console.log("正在使用FormSubmit发送表单数据");
    const form = document.getElementById('contactForm');
    const submitBtn = document.querySelector('.submit-button');
    
    // 检查formStatus是否存在，如果不存在则创建
    let formStatus = document.getElementById('formStatus');
    if (!formStatus) {
        formStatus = document.createElement('div');
        formStatus.id = 'formStatus';
        formStatus.style.display = 'none';
        formStatus.style.marginTop = '20px';
        formStatus.style.borderRadius = '8px';
        formStatus.style.padding = '12px';
        form.parentElement.appendChild(formStatus);
    }
    
    // 使用隐藏表单直接提交到FormSubmit
    try {
        // 创建一个隐藏的表单元素
        const hiddenForm = document.createElement('form');
        hiddenForm.method = 'POST';
        hiddenForm.action = 'https://formsubmit.co/13470118418@163.com';
        hiddenForm.style.display = 'none';
        
        // 添加FormSubmit所需的字段
        const createField = (name, value) => {
            const field = document.createElement('input');
            field.type = 'hidden';
            field.name = name;
            field.value = value;
            return field;
        };
        
        // 添加所有表单字段
        hiddenForm.appendChild(createField('name', formData.from_name || formData.name));
        hiddenForm.appendChild(createField('phone', formData.phone));
        hiddenForm.appendChild(createField('email', formData.email));
        hiddenForm.appendChild(createField('subject', formData.subject));
        hiddenForm.appendChild(createField('message', formData.message));
        
        // 添加FormSubmit特定选项
        hiddenForm.appendChild(createField('_captcha', 'false')); // 禁用验证码
        hiddenForm.appendChild(createField('_subject', '牛顿环虚拟仿真实验 - 联系表单提交')); // 设置邮件主题
        hiddenForm.appendChild(createField('_template', 'table')); // 使用表格模板
        hiddenForm.appendChild(createField('_next', window.location.href)); // 成功后返回当前页面
        hiddenForm.appendChild(createField('_autoresponse', '感谢您的留言，我们已收到您的信息，会尽快与您联系！')); // 自动回复内容
        
        // 将表单添加到文档并提交
        document.body.appendChild(hiddenForm);
        
        console.log("准备提交隐藏表单", hiddenForm);
        
        // 显示一个成功消息
        formStatus.innerHTML = '<div class="alert alert-success" style="background-color:#d4edda;color:#155724;padding:10px;border-radius:5px;">正在提交表单，请稍候...</div>';
        formStatus.style.display = 'block';
        
        // 提交表单
        hiddenForm.submit();
        
        // 清空原表单
        form.reset();
    } catch (error) {
        console.error("表单提交过程中出错:", error);
        formStatus.innerHTML = '<div class="alert alert-danger" style="background-color:#f8d7da;color:#721c24;padding:10px;border-radius:5px;">提交失败，请稍后再试或直接联系我们。错误信息: ' + error.message + '</div>';
        formStatus.style.display = 'block';
        
        // 恢复提交按钮状态
        submitBtn.disabled = false;
        submitBtn.innerHTML = '发送消息 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
}

// 页面加载完成后添加事件监听器
document.addEventListener('DOMContentLoaded', function() {
    console.log("页面已加载，正在设置表单事件监听器");
    
    // 获取表单元素
    const contactForm = document.getElementById('contactForm');
    if (!contactForm) {
        console.error("找不到contactForm表单元素");
        return;
    }
    
    // 设置_next参数为当前URL
    const nextInput = contactForm.querySelector('input[name="_next"]');
    if (nextInput) {
        nextInput.value = window.location.href;
        console.log("设置FormSubmit重定向URL为:", window.location.href);
    }
    
    // 创建表单状态元素
    let formStatusDiv = document.getElementById('formStatus');
    if (!formStatusDiv) {
        formStatusDiv = document.createElement('div');
        formStatusDiv.id = 'formStatus';
        formStatusDiv.style.display = 'none';
        formStatusDiv.style.marginTop = '20px';
        formStatusDiv.style.borderRadius = '8px';
        formStatusDiv.style.padding = '12px';
        
        // 将状态元素添加到表单容器后面
        contactForm.parentElement.appendChild(formStatusDiv);
        console.log("已创建formStatus元素");
    }
    
    // 添加提交事件监听器
    contactForm.addEventListener('submit', submitContactForm);
    console.log("已添加表单提交事件监听器");
    
    // 测试按钮点击事件是否正常触发
    const submitButton = contactForm.querySelector('button[type="submit"]');
    if (submitButton) {
        console.log("找到提交按钮:", submitButton);
        submitButton.classList.add('setupComplete');
    } else {
        console.error("找不到表单提交按钮");
    }
}); 