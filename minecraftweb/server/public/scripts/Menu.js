let SelectedWorld = null;
let Token = null;
let Username = null;
let IsAdmin = false;
let PlayerCountInterval = null;

function ShowSessionToast(Name)
{
    const Toast = document.getElementById('SessionToast');
    Toast.innerHTML = 'Вы вошли как <span class="Highlight">' + Name + '</span>';
    requestAnimationFrame(() => Toast.classList.add('Visible'));
    setTimeout(() =>
    {
        Toast.classList.remove('Visible');
    }, 4000);
}

function GetWorldNumericId(WorldId)
{
    return WorldId.replace(/^world-/, '');
}

function JoinWorld(World)
{
    localStorage.setItem('ls_currentWorld', JSON.stringify(World));
    window.location.href = '/world?worldId=' + World.id;
}

async function LoadWorlds()
{
    try
    {
        const Response = await fetch('/api/worlds',
        {
            headers: { 'Authorization': `Bearer ${Token}` }
        });

        if (Response.ok)
        {
            const Data = await Response.json();
            UpdateWorldsList(Data.worlds);
        }
    }
    catch (Error)
    {
        console.error('Error loading worlds:', Error);
    }
}

async function DeleteWorld(WorldId)
{
    try
    {
        const Response = await fetch(`/api/worlds/${WorldId}`,
        {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${Token}` }
        });

        if (Response.ok)
        {
            alert('Мир удален!');
            LoadWorlds();
        }
        else
        {
            const Data = await Response.json();
            alert('Ошибка: ' + Data.error);
        }
    }
    catch (Error)
    {
        console.error('Error deleting world:', Error);
        alert('Ошибка при удалении мира');
    }
}

function UpdateWorldMeta(Item, World)
{
    const OnlineCount = World.onlineCount || 0;
    const Dot = Item.querySelector('.StatusDot');
    const CountEl = Item.querySelector('.PlayerCount');

    Dot.classList.toggle('Online', OnlineCount > 0);
    Dot.classList.toggle('Offline', OnlineCount === 0);
    CountEl.textContent = OnlineCount;
}

function UpdateWorldsList(Worlds)
{
    const List = document.getElementById('WorldsList');
    const PreviousSelection = SelectedWorld ? SelectedWorld.id : null;
    List.innerHTML = '';

    Worlds.forEach(World =>
    {
        const Item = document.createElement('div');
        Item.className = 'WorldItem';
        if (IsAdmin) Item.classList.add('Admin');

        const NameSpan = document.createElement('span');
        NameSpan.className = 'WorldName';
        NameSpan.textContent = World.name;
        Item.appendChild(NameSpan);

        const Meta = document.createElement('div');
        Meta.className = 'WorldMeta';

        const StatusDot = document.createElement('span');
        StatusDot.className = 'StatusDot';
        Meta.appendChild(StatusDot);

        const IdSpan = document.createElement('span');
        IdSpan.className = 'WorldId';
        IdSpan.textContent = GetWorldNumericId(World.id);
        IdSpan.title = World.id;
        Meta.appendChild(IdSpan);

        const CountSpan = document.createElement('span');
        CountSpan.className = 'PlayerCount';
        Meta.appendChild(CountSpan);

        if (IsAdmin)
        {
            const DeleteBtn = document.createElement('button');
            DeleteBtn.className = 'DeleteBtn';
            DeleteBtn.innerHTML = '&times;';
            DeleteBtn.title = 'Удалить мир';
            DeleteBtn.onclick = (Event) =>
            {
                Event.stopPropagation();
                if (confirm('Удалить мир "' + World.name + '"?'))
                {
                    DeleteWorld(World.id);
                }
            };
            Meta.appendChild(DeleteBtn);
        }

        Item.appendChild(Meta);
        UpdateWorldMeta(Item, World);

        Item.dataset.WorldId = World.id;

        Item.addEventListener('click', () =>
        {
            document.querySelectorAll('.WorldItem').forEach(Entry => Entry.classList.remove('Selected'));
            Item.classList.add('Selected');
            SelectedWorld = World;
            document.getElementById('JoinBtn').disabled = false;
        });

        if (PreviousSelection === World.id)
        {
            Item.classList.add('Selected');
            SelectedWorld = World;
            document.getElementById('JoinBtn').disabled = false;
        }

        List.appendChild(Item);
    });

    if (Worlds.length === 0)
    {
        SelectedWorld = null;
        document.getElementById('JoinBtn').disabled = true;
    }
}

function OpenJoinByIdModal()
{
    const Overlay = document.getElementById('JoinByIdOverlay');
    const Input = document.getElementById('JoinByIdInput');
    const ErrorEl = document.getElementById('JoinByIdError');

    ErrorEl.textContent = '';
    Input.value = '';
    Overlay.classList.add('Visible');
    Input.focus();
}

function CloseJoinByIdModal()
{
    document.getElementById('JoinByIdOverlay').classList.remove('Visible');
    document.getElementById('JoinByIdError').textContent = '';
}

async function ConnectByWorldId()
{
    const Digits = document.getElementById('JoinByIdInput').value.replace(/\D/g, '');
    const ErrorEl = document.getElementById('JoinByIdError');

    if (!Digits)
    {
        ErrorEl.textContent = 'Введите ID мира (только цифры)';
        return;
    }

    const WorldId = 'world-' + Digits;

    try
    {
        const Response = await fetch(`/api/worlds/${WorldId}`,
        {
            headers: { 'Authorization': `Bearer ${Token}` }
        });

        const Data = await Response.json();

        if (Response.ok)
        {
            JoinWorld(Data.world);
        }
        else
        {
            ErrorEl.textContent = Data.error || 'Мир не найден';
        }
    }
    catch (Error)
    {
        ErrorEl.textContent = 'Ошибка подключения';
        console.error('Connect by ID error:', Error);
    }
}

async function RefreshPlayerCounts()
{
    try
    {
        const Response = await fetch('/api/worlds',
        {
            headers: { 'Authorization': `Bearer ${Token}` }
        });

        if (!Response.ok)
            return;

        const Data = await Response.json();

        document.querySelectorAll('.WorldItem').forEach(Item =>
        {
            const World = Data.worlds.find(Entry => Entry.id === Item.dataset.WorldId);
            if (World)
                UpdateWorldMeta(Item, World);
        });
    }
    catch (Error)
    {
        console.error('Error refreshing player counts:', Error);
    }
}

function LogConsole(Output, Message, Color)
{
    const Line = document.createElement('div');
    Line.style.color = Color || '#aaffaa';
    Line.textContent = '> ' + Message;
    Output.appendChild(Line);
    Output.scrollTop = Output.scrollHeight;
}

function GetLogColor(Action)
{
    if (Action.includes('зарегистрировался')) return '#aaffaa';
    if (Action.includes('вошёл в аккаунт')) return '#aaffff';
    if (Action.includes('вошёл в мир')) return '#ffdd88';
    if (Action.includes('создал мир')) return '#88ddff';
    if (Action.includes('удалил мир')) return '#ff8888';
    if (Action.includes('забанил')) return '#ff5555';
    if (Action.includes('разбанил')) return '#55ff55';
    return '#aaffff';
}

function InitAdminConsole()
{
    const ConsoleEl = document.getElementById('AdminConsole');
    const Output = document.getElementById('ConsoleOutput');
    const Input = document.getElementById('ConsoleInput');

    document.addEventListener('keydown', (Event) =>
    {
        if (Event.code === 'Backquote')
        {
            Event.preventDefault();
            ConsoleEl.style.display = ConsoleEl.style.display === 'none' ? 'block' : 'none';
            if (ConsoleEl.style.display === 'block') Input.focus();
        }
    });

    Input.addEventListener('keydown', async (Event) =>
    {
        if (Event.key !== 'Enter') return;
        const Cmd = Input.value.trim();
        Input.value = '';
        if (!Cmd) return;

        const Parts = Cmd.split(' ');
        const Action = Parts[0].toLowerCase();
        const Target = Parts[1];

        if ((Action === 'ban' || Action === 'unban') && Target)
        {
            try
            {
                const Response = await fetch(`/api/${Action}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Token}` },
                    body: JSON.stringify({ username: Target })
                });
                const Text = await Response.text();
                let Data;
                try
                {
                    Data = JSON.parse(Text);
                }
                catch
                {
                    LogConsole(Output, 'Сервер вернул не JSON: ' + Text.substring(0, 100), '#ff5555');
                    return;
                }
                LogConsole(Output, Data.message || Data.error, Response.ok ? '#aaffaa' : '#ff5555');
            }
            catch (Error)
            {
                LogConsole(Output, 'Ошибка запроса: ' + Error.message, '#ff5555');
            }
        }
        else if (Action === 'logs')
        {
            const Response = await fetch('/api/logs',
            {
                headers: { 'Authorization': `Bearer ${Token}` }
            });
            const Data = await Response.json();
            if (Response.ok)
            {
                if (Data.logs.length === 0)
                {
                    LogConsole(Output, 'Логи пусты', '#ffff55');
                }
                else
                {
                    const Count = Parts[1] ? parseInt(Parts[1]) : 50;
                    Data.logs.slice(-Count).forEach(LogEntry =>
                    {
                        const Time = new Date(LogEntry.time).toLocaleString('ru');
                        LogConsole(Output, `[${Time}] ${LogEntry.username}: ${LogEntry.action}`, GetLogColor(LogEntry.action));
                    });
                }
            }
            else
            {
                LogConsole(Output, Data.error, '#ff5555');
            }
        }
        else
        {
            LogConsole(Output, 'Команды: ban <username> | unban <username> | logs [N]', '#ffff55');
        }
    });
}

function InitMenu()
{
    Token = localStorage.getItem('ls_token');
    Username = localStorage.getItem('ls_username');
    IsAdmin = localStorage.getItem('ls_IsAdmin') === 'true';

    if (!Token || !Username)
    {
        window.location.href = '/';
        return;
    }

    document.getElementById('UserNameDisplay').textContent = Username;
    ShowSessionToast(Username);

    LoadWorlds();
    PlayerCountInterval = setInterval(RefreshPlayerCounts, 5000);

    if (IsAdmin)
    {
        const DeleteAllBtn = document.getElementById('DeleteAllBtn');
        DeleteAllBtn.style.display = 'block';
        DeleteAllBtn.addEventListener('click', async () =>
        {
            if (!confirm('Удалить ВСЕ миры? Это действие нельзя отменить!')) return;
            const Response = await fetch('/api/worlds',
            {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${Token}` }
            });
            const Data = await Response.json();
            alert(Data.message || Data.error);
            LoadWorlds();
        });

        InitAdminConsole();
    }

    if (typeof io !== 'undefined')
    {
        const Socket = io({ reconnection: false });

        Socket.on('world_created', () => { LoadWorlds(); });
        Socket.on('world_deleted', () => { LoadWorlds(); });

        window.addEventListener('beforeunload', () =>
        {
            clearInterval(PlayerCountInterval);
            Socket.disconnect();
        });
    }

    document.getElementById('JoinBtn').addEventListener('click', () =>
    {
        if (SelectedWorld) JoinWorld(SelectedWorld);
    });

    document.getElementById('CreateWorldBtn').addEventListener('click', () =>
    {
        window.location.href = '/create-world';
    });

    document.getElementById('JoinByIdBtn').addEventListener('click', OpenJoinByIdModal);
    document.getElementById('JoinByIdCancelBtn').addEventListener('click', CloseJoinByIdModal);
    document.getElementById('JoinByIdConfirmBtn').addEventListener('click', ConnectByWorldId);
    document.getElementById('JoinByIdOverlay').addEventListener('click', (Event) =>
    {
        if (Event.target.id === 'JoinByIdOverlay') CloseJoinByIdModal();
    });
    document.getElementById('JoinByIdInput').addEventListener('keydown', (Event) =>
    {
        if (Event.key === 'Enter') ConnectByWorldId();
        if (Event.key === 'Escape') CloseJoinByIdModal();
    });
    document.getElementById('JoinByIdInput').addEventListener('input', (Event) =>
    {
        Event.target.value = Event.target.value.replace(/\D/g, '');
    });

    document.getElementById('ExitBtn').addEventListener('click', () =>
    {
        localStorage.removeItem('ls_token');
        localStorage.removeItem('ls_username');
        localStorage.removeItem('ls_IsAdmin');
        localStorage.removeItem('ls_currentWorld');
        window.location.href = '/';
    });
}

InitMenu();
