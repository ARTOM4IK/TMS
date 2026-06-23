const Jwt = require('jsonwebtoken');
const
{
  FindUserByUsername,
  FindUserById,
  SetBanned,
  SetUserRole,
  IsUserAdmin,
  WriteLog
} = require('./storage');

const JwtSecret = process.env.SESSION_SECRET || 'webminecraft_secret_key_2024';

async function GetUserFromToken(Token)
{
  if (!Token)
    return null;

  try
  {
    const Decoded = Jwt.verify(Token, JwtSecret);
    return FindUserById(Decoded.id);
  }
  catch (Error)
  {
    return null;
  }
}

function ResolveRole(User)
{
  if (!User)
    return 'player';
  if (User.role === 'homelander' || User.IsAdmin)
    return 'homelander';
  return 'player';
}

function CanUseCommands(User)
{
  return ResolveRole(User) === 'homelander';
}

async function ProcessChatCommand(User, CommandText, Io, Room)
{
  const Parts = CommandText.trim().split(/\s+/);
  const Cmd = (Parts[0] || '').toLowerCase();
  const Args = Parts.slice(1);

  if (!CanUseCommands(User))
    return { ok: false, text: 'Недостаточно прав. Нужна привилегия homelander.' };

  switch (Cmd)
  {
    case 'kick':
    {
      const TargetName = Args[0];
      if (!TargetName)
        return { ok: false, text: 'Использование: /kick <ник>' };

      Io.in(Room).fetchSockets().then(Sockets =>
      {
        for (const Sock of Sockets)
        {
          if (Sock.data.name === TargetName.toLowerCase())
          {
            Sock.emit('chat_broadcast', { type: 'system', text: `Вы были кикнуты ${User.username}` });
            Sock.disconnect(true);
          }
        }
      });

      await WriteLog(User.username, `кикнул ${TargetName} в ${Room}`);
      return { ok: true, text: `Игрок ${TargetName} кикнут.` };
    }

    case 'ban':
    {
      const TargetName = Args[0];
      if (!TargetName)
        return { ok: false, text: 'Использование: /ban <ник>' };

      const Target = await FindUserByUsername(TargetName);
      if (Target && IsUserAdmin(Target))
        return { ok: false, text: 'Нельзя банить homelander/admin.' };

      await SetBanned(TargetName, true);
      await WriteLog(User.username, `забанил ${TargetName}`);

      Io.in(Room).fetchSockets().then(Sockets =>
      {
        for (const Sock of Sockets)
        {
          if (Sock.data.name === TargetName.toLowerCase())
            Sock.disconnect(true);
        }
      });

      return { ok: true, text: `${TargetName} забанен.` };
    }

    case 'tp':
    {
      const TargetName = Args[0]?.toLowerCase();
      if (!TargetName)
        return { ok: false, text: 'Использование: /tp <ник>' };

      const Sockets = await Io.in(Room).fetchSockets();
      let TargetPos = null;

      for (const TargetSock of Sockets)
      {
        if (TargetSock.data.name === TargetName && TargetSock.data.position)
        {
          TargetPos = TargetSock.data.position;
          break;
        }
      }

      if (!TargetPos)
        return { ok: false, text: `Игрок ${TargetName} не найден или позиция недоступна.` };

      for (const Sock of Sockets)
      {
        if (Sock.data.name === User.username)
        {
          Sock.emit('chat_broadcast', {
            type: 'command_result',
            ok: true,
            text: `Телепорт к ${TargetName}`,
            teleport: TargetPos
          });
        }
      }

      return { ok: true, text: `Телепорт к ${TargetName}.` };
    }

    case 'role':
    {
      const TargetName = Args[0];
      const NewRole = Args[1];
      if (!TargetName || !NewRole)
        return { ok: false, text: 'Использование: /role <ник> <player|homelander>' };

      if (!['player', 'homelander'].includes(NewRole))
        return { ok: false, text: 'Роль: player или homelander' };

      const Updated = await SetUserRole(TargetName, NewRole);
      if (!Updated)
        return { ok: false, text: 'Пользователь не найден.' };

      await WriteLog(User.username, `выдал роль ${NewRole} игроку ${TargetName}`);
      return { ok: true, text: `${TargetName} → ${NewRole}` };
    }

    case 'help':
      return {
        ok: true,
        text: 'Команды: /kick /ban /tp /role /help'
      };

    default:
      return { ok: false, text: `Неизвестная команда: /${Cmd}. /help` };
  }
}

module.exports =
{
  GetUserFromToken,
  ResolveRole,
  ProcessChatCommand
};
